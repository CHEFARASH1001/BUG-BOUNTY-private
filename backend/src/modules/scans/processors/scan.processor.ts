import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scan, ScanDocument, ScanStatus, ScanType } from '../../../schemas/scan.schema';
import { Domain, DomainDocument } from '../../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../../schemas/subdomain.schema';
import { Vulnerability, VulnerabilityDocument } from '../../../schemas/vulnerability.schema';
import { Endpoint, EndpointDocument } from '../../../schemas/endpoint.schema';
import { ReconService } from '../../recon/recon.service';
import { ScannerService } from '../../scanner/scanner.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

interface ScanJobData {
  scanId: string;
  targetId: string;
  target: string;
  type: string;
  config?: Record<string, any>;
}

@Processor('scans')
@Injectable()
export class ScanProcessor {
  constructor(
    @InjectModel(Scan.name) private scanModel: Model<ScanDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
    @InjectModel(Endpoint.name) private endpointModel: Model<EndpointDocument>,
    @Inject(forwardRef(() => ReconService)) private reconService: ReconService,
    @Inject(forwardRef(() => ScannerService)) private scannerService: ScannerService,
    @Inject(forwardRef(() => NotificationsService)) private notificationsService: NotificationsService,
    @Inject(forwardRef(() => WebsocketGateway)) private websocketGateway: WebsocketGateway,
  ) {}

  @OnQueueActive()
  onActive(job: Job<ScanJobData>) {
    console.log(`[Scan] Starting job ${job.id} - ${job.data.type} on ${job.data.target}`);
    this.websocketGateway.emitScanUpdate(job.data.scanId, {
      status: 'running',
      progress: 0,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ScanJobData>) {
    console.log(`[Scan] Completed job ${job.id}`);
    this.websocketGateway.emitScanUpdate(job.data.scanId, {
      status: 'completed',
      progress: 100,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job<ScanJobData>, error: Error) {
    console.error(`[Scan] Failed job ${job.id}:`, error.message);
    this.websocketGateway.emitScanUpdate(job.data.scanId, {
      status: 'failed',
      error: error.message,
    });
  }

  @Process('full-scan')
  async handleFullScan(job: Job<ScanJobData>) {
    const { scanId, targetId, target } = job.data;

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);

      // Step 1: Subdomain Enumeration (0-30%)
      await this.updateProgress(scanId, 5, 'Enumerating subdomains...');
      const subdomains = await this.reconService.enumerateSubdomains(target);
      await this.updateProgress(scanId, 30, `Found ${subdomains.length} subdomains`);

      // Save subdomains
      for (const sub of subdomains) {
        await this.saveSubdomain(targetId, sub);
      }

      // Step 2: HTTP Probing (30-45%)
      await this.updateProgress(scanId, 35, 'Probing HTTP services...');
      const aliveHosts = await this.reconService.probeHttp(subdomains);
      await this.updateProgress(scanId, 45, `${aliveHosts.length} hosts alive`);

      // Update subdomain status
      for (const host of aliveHosts) {
        await this.subdomainModel.updateOne(
          { subdomain: host.subdomain },
          {
            isAlive: true,
            httpStatus: host.statusCode,
            title: host.title,
            contentLength: host.contentLength,
            technologies: host.technologies,
            webServer: host.webServer,
          },
        );
      }

      // Step 3: Port Scanning (45-60%)
      await this.updateProgress(scanId, 50, 'Scanning ports...');
      const portResults = await this.reconService.scanPorts(
        subdomains.slice(0, 100), // Limit for performance
      );
      await this.updateProgress(scanId, 60, 'Port scanning complete');

      // Update port info
      for (const result of portResults) {
        await this.subdomainModel.updateOne(
          { subdomain: result.host },
          { ports: result.ports },
        );
      }

      // Step 4: Technology Detection (60-70%)
      await this.updateProgress(scanId, 65, 'Detecting technologies...');
      const techResults = await this.reconService.detectTechnologies(
        aliveHosts.map((h) => h.url),
      );
      await this.updateProgress(scanId, 70, 'Technology detection complete');

      // Step 5: Nuclei Vulnerability Scanning (70-95%)
      await this.updateProgress(scanId, 75, 'Running vulnerability scans...');
      const vulnResults = await this.scannerService.runNucleiScan(
        aliveHosts.map((h) => h.url),
      );
      await this.updateProgress(scanId, 95, `Found ${vulnResults.length} potential vulnerabilities`);

      // Save vulnerabilities
      for (const vuln of vulnResults) {
        await this.saveVulnerability(targetId, vuln);
      }

      // Step 6: Complete
      await this.updateProgress(scanId, 100, 'Scan complete');
      await this.completeScan(scanId, {
        subdomainsFound: subdomains.length,
        aliveHosts: aliveHosts.length,
        portsFound: portResults.reduce((acc, r) => acc + r.ports.length, 0),
        vulnerabilitiesFound: vulnResults.length,
        technologiesFound: [...new Set(techResults.flat())],
      });

      // Update domain status
      await this.domainModel.findByIdAndUpdate(targetId, {
        status: 'completed',
        lastScan: new Date(),
        subdomainCount: subdomains.length,
        vulnerabilityCount: vulnResults.length,
      });

      // Send notifications
      if (vulnResults.length > 0) {
        await this.notificationsService.sendVulnerabilityAlert(vulnResults, target);
      }

      return { success: true, vulnerabilities: vulnResults.length };
    } catch (error: any) {
      await this.failScan(scanId, error.message);
      throw error;
    }
  }

  @Process('subdomain-scan')
  async handleSubdomainScan(job: Job<ScanJobData>) {
    const { scanId, targetId, target } = job.data;

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting subdomain enumeration...');

      const subdomains = await this.reconService.enumerateSubdomains(target);
      await this.updateProgress(scanId, 80, `Found ${subdomains.length} subdomains`);

      for (const sub of subdomains) {
        await this.saveSubdomain(targetId, sub);
      }

      await this.completeScan(scanId, { subdomainsFound: subdomains.length });
      return { success: true, count: subdomains.length };
    } catch (error: any) {
      await this.failScan(scanId, error.message);
      throw error;
    }
  }

  @Process('port-scan')
  async handlePortScan(job: Job<ScanJobData>) {
    const { scanId, target } = job.data;

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting port scan...');

      const results = await this.reconService.scanPorts([target]);
      await this.updateProgress(scanId, 90, `Found ${results[0]?.ports?.length || 0} open ports`);

      await this.completeScan(scanId, { portsFound: results[0]?.ports?.length || 0 });
      return { success: true, ports: results[0]?.ports };
    } catch (error: any) {
      await this.failScan(scanId, error.message);
      throw error;
    }
  }

  @Process('nuclei-scan')
  async handleNucleiScan(job: Job<ScanJobData>) {
    const { scanId, target, config } = job.data;

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting Nuclei scan...');

      const results = await this.scannerService.runNucleiScan(
        [target],
        config?.templates,
      );
      await this.updateProgress(scanId, 90, `Found ${results.length} vulnerabilities`);

      await this.completeScan(scanId, { vulnerabilitiesFound: results.length });
      return { success: true, vulnerabilities: results };
    } catch (error: any) {
      await this.failScan(scanId, error.message);
      throw error;
    }
  }

  private async updateScanStatus(scanId: string, status: ScanStatus) {
    await this.scanModel.findByIdAndUpdate(scanId, {
      status,
      startedAt: status === ScanStatus.RUNNING ? new Date() : undefined,
    });
  }

  private async updateProgress(scanId: string, progress: number, currentStep: string) {
    await this.scanModel.findByIdAndUpdate(scanId, {
      progress,
      currentStep,
      $push: { logs: `[${new Date().toISOString()}] ${currentStep}` },
    });
    this.websocketGateway.emitScanUpdate(scanId, { progress, currentStep });
  }

  private async completeScan(scanId: string, results: any) {
    await this.scanModel.findByIdAndUpdate(scanId, {
      status: ScanStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
      results,
    });
  }

  private async failScan(scanId: string, error: string) {
    await this.scanModel.findByIdAndUpdate(scanId, {
      status: ScanStatus.FAILED,
      error,
      completedAt: new Date(),
    });
  }

  private async saveSubdomain(domainId: string, subdomain: string) {
    await this.subdomainModel.updateOne(
      { subdomain: subdomain.toLowerCase() },
      {
        $setOnInsert: {
          subdomain: subdomain.toLowerCase(),
          domainId: new Types.ObjectId(domainId),
          firstSeen: new Date(),
          isNew: true,
        },
        $set: { lastSeen: new Date() },
      },
      { upsert: true },
    );
  }

  private async saveVulnerability(targetId: string, vuln: any) {
    const hash = this.generateVulnHash(vuln);

    await this.vulnModel.updateOne(
      { hash },
      {
        $setOnInsert: {
          title: vuln.info?.name || vuln.templateID,
          description: vuln.info?.description,
          severity: vuln.info?.severity || 'info',
          type: vuln.type,
          target: vuln.host || vuln.matched,
          targetId: new Types.ObjectId(targetId),
          targetType: 'domain',
          template: vuln.templateID,
          templatePath: vuln.templatePath,
          matcher: vuln.matcherName,
          evidence: {
            request: vuln.request,
            response: vuln.response,
            matchedAt: vuln.matched,
            extractedResults: vuln.extractedResults,
          },
          metadata: vuln.info,
          hash,
          isNew: true,
        },
      },
      { upsert: true },
    );
  }

  private generateVulnHash(vuln: any): string {
    const data = `${vuln.templateID}-${vuln.host}-${vuln.matched}`;
    return Buffer.from(data).toString('base64');
  }
}

