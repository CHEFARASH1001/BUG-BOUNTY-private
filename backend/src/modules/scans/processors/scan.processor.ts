import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scan, ScanDocument, ScanStatus } from '../../../schemas/scan.schema';
import { Domain, DomainDocument } from '../../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../../schemas/subdomain.schema';
import { Vulnerability, VulnerabilityDocument } from '../../../schemas/vulnerability.schema';
import { Endpoint, EndpointDocument } from '../../../schemas/endpoint.schema';
import { ReconService } from '../../recon/recon.service';
import { ScannerService } from '../../scanner/scanner.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { QueueConstants } from '../../queue/queue.constants';
import { ScanJobData } from '../../queue/queue.service';

@Injectable()
export class ScanProcessor {
  private readonly logger = new Logger(ScanProcessor.name);

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

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_FULL_SCAN,
    queue: QueueConstants.QUEUE_SCANS,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
  })
  async handleFullScan(data: ScanJobData): Promise<void | Nack> {
    const { scanId, targetId, target } = data;
    this.logger.log(`Starting full scan for ${target} (scanId: ${scanId})`);

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      this.websocketGateway.emitScanUpdate(scanId, { status: 'running', progress: 0 });

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

      this.websocketGateway.emitScanUpdate(scanId, { status: 'completed', progress: 100 });
      this.logger.log(`Full scan completed for ${target}`);
    } catch (error: any) {
      this.logger.error(`Full scan failed for ${target}: ${error.message}`);
      await this.failScan(scanId, error.message);
      this.websocketGateway.emitScanUpdate(scanId, { status: 'failed', error: error.message });
      return new Nack(false); // Don't requeue on failure
    }
  }

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_SUBDOMAIN_SCAN,
    queue: QueueConstants.QUEUE_SCANS,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
  })
  async handleSubdomainScan(data: ScanJobData): Promise<void | Nack> {
    const { scanId, targetId, target } = data;
    this.logger.log(`Starting subdomain scan for ${target}`);

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting subdomain enumeration...');

      const subdomains = await this.reconService.enumerateSubdomains(target);
      await this.updateProgress(scanId, 80, `Found ${subdomains.length} subdomains`);

      for (const sub of subdomains) {
        await this.saveSubdomain(targetId, sub);
      }

      await this.completeScan(scanId, { subdomainsFound: subdomains.length });
      this.logger.log(`Subdomain scan completed for ${target}: ${subdomains.length} found`);
    } catch (error: any) {
      this.logger.error(`Subdomain scan failed for ${target}: ${error.message}`);
      await this.failScan(scanId, error.message);
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_PORT_SCAN,
    queue: QueueConstants.QUEUE_SCANS,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
  })
  async handlePortScan(data: ScanJobData): Promise<void | Nack> {
    const { scanId, target } = data;
    this.logger.log(`Starting port scan for ${target}`);

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting port scan...');

      const results = await this.reconService.scanPorts([target]);
      await this.updateProgress(scanId, 90, `Found ${results[0]?.ports?.length || 0} open ports`);

      await this.completeScan(scanId, { portsFound: results[0]?.ports?.length || 0 });
      this.logger.log(`Port scan completed for ${target}`);
    } catch (error: any) {
      this.logger.error(`Port scan failed for ${target}: ${error.message}`);
      await this.failScan(scanId, error.message);
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_NUCLEI_SCAN,
    queue: QueueConstants.QUEUE_NUCLEI,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
  })
  async handleNucleiScan(data: ScanJobData): Promise<void | Nack> {
    const { scanId, target, config } = data;
    this.logger.log(`Starting Nuclei scan for ${target}`);

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      await this.updateProgress(scanId, 10, 'Starting Nuclei scan...');

      const results = await this.scannerService.runNucleiScan(
        [target],
        config?.templates,
      );
      await this.updateProgress(scanId, 90, `Found ${results.length} vulnerabilities`);

      await this.completeScan(scanId, { vulnerabilitiesFound: results.length });
      this.logger.log(`Nuclei scan completed for ${target}: ${results.length} vulnerabilities`);
    } catch (error: any) {
      this.logger.error(`Nuclei scan failed for ${target}: ${error.message}`);
      await this.failScan(scanId, error.message);
      return new Nack(false);
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
