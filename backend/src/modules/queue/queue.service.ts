import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { QueueConstants } from './queue.constants';

export interface ScanJobData {
  scanId: string;
  targetId: string;
  target: string;
  type: string;
  config?: Record<string, any>;
}

export interface EnumJobData {
  domain: string;
  providers?: string[];
  programId?: string;
}

export interface DnsJobData {
  subdomains: string[];
  domain: string;
  programId?: string;
}

export interface HttpJobData {
  hosts: string[];
  domain: string;
  programId?: string;
}

export interface NucleiJobData {
  urls: string[];
  templates?: string[];
  severity?: string[];
  programId?: string;
}

export interface NotifyJobData {
  type: 'new_subdomain' | 'new_live' | 'status_change' | 'title_change' | 'tech_change' | 'vulnerability';
  data: Record<string, any>;
  channels?: string[];
}

export interface SubfinderJobData {
  domain: string;
  domainId: string;
  jobId?: string;
  batchId?: string;
}

export interface PlatformSyncJobData {
  type: 'bounty-targets' | 'chaos';
  program: any;
  batchId: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publishScanJob(routingKey: string, data: ScanJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        routingKey,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published scan job: ${routingKey} for ${data.target}`);
    } catch (error) {
      this.logger.error(`Failed to publish scan job: ${error.message}`);
      throw error;
    }
  }

  async publishFullScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_FULL_SCAN, data);
  }

  async publishSubdomainScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_SUBDOMAIN_SCAN, data);
  }

  async publishDnsScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_DNS_SCAN, data);
  }

  async publishHttpScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_HTTP_SCAN, data);
  }

  async publishNucleiScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_NUCLEI_SCAN, data);
  }

  async publishPortScan(data: ScanJobData): Promise<void> {
    return this.publishScanJob(QueueConstants.ROUTING_PORT_SCAN, data);
  }

  async publishEnumJob(data: EnumJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_ENUM,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published enum job for domain: ${data.domain}`);
    } catch (error) {
      this.logger.error(`Failed to publish enum job: ${error.message}`);
      throw error;
    }
  }

  async publishDnsJob(data: DnsJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_DNS,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published DNS job for ${data.subdomains.length} subdomains`);
    } catch (error) {
      this.logger.error(`Failed to publish DNS job: ${error.message}`);
      throw error;
    }
  }

  async publishHttpJob(data: HttpJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_HTTP,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published HTTP job for ${data.hosts.length} hosts`);
    } catch (error) {
      this.logger.error(`Failed to publish HTTP job: ${error.message}`);
      throw error;
    }
  }

  async publishNucleiJob(data: NucleiJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_NUCLEI,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published Nuclei job for ${data.urls.length} URLs`);
    } catch (error) {
      this.logger.error(`Failed to publish Nuclei job: ${error.message}`);
      throw error;
    }
  }

  async publishNotification(data: NotifyJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_NOTIFY,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published notification: ${data.type}`);
    } catch (error) {
      this.logger.error(`Failed to publish notification: ${error.message}`);
      throw error;
    }
  }

  async publishSubfinderJob(data: SubfinderJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_SUBFINDER,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
      this.logger.log(`Published subfinder job for domain: ${data.domain}`);
    } catch (error) {
      this.logger.error(`Failed to publish subfinder job: ${error.message}`);
      throw error;
    }
  }

  async publishSubfinderBatch(domains: { domain: string; domainId: string }[], batchId: string): Promise<number> {
    let published = 0;
    for (const d of domains) {
      try {
        await this.publishSubfinderJob({
          domain: d.domain,
          domainId: d.domainId,
          batchId,
        });
        published++;
      } catch (error) {
        this.logger.error(`Failed to publish subfinder job for ${d.domain}: ${error.message}`);
      }
    }
    this.logger.log(`Published ${published}/${domains.length} subfinder jobs for batch ${batchId}`);
    return published;
  }

  async publishPlatformSyncJob(data: PlatformSyncJobData): Promise<void> {
    try {
      await this.amqpConnection.publish(
        QueueConstants.EXCHANGE_DIRECT,
        QueueConstants.ROUTING_PLATFORM_SYNC,
        data,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        },
      );
    } catch (error) {
      this.logger.error(`Failed to publish platform sync job: ${error.message}`);
      throw error;
    }
  }

  async publishPlatformSyncBatch(
    programs: any[],
    type: 'bounty-targets' | 'chaos',
    batchId: string,
  ): Promise<number> {
    let published = 0;
    for (const program of programs) {
      try {
        await this.publishPlatformSyncJob({
          type,
          program,
          batchId,
        });
        published++;
      } catch (error) {
        this.logger.error(`Failed to publish platform sync job for ${program.handle}: ${error.message}`);
      }
    }
    this.logger.log(`Published ${published}/${programs.length} platform sync jobs for batch ${batchId}`);
    return published;
  }
}

