import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { QueueConstants } from '../queue/queue.constants';

const execAsync = promisify(exec);

export interface SubfinderJobData {
  domain: string;
  domainId: string;
  jobId?: string;
  batchId?: string;
}

export interface SubfinderResult {
  domain: string;
  success: boolean;
  total: number;
  created: number;
  updated: number;
  duration: number;
  error?: string;
}

@Injectable()
export class SubfinderWorker {
  private readonly logger = new Logger(SubfinderWorker.name);
  private readonly source = 'subfinder';

  constructor(
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
  ) {}

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_SUBFINDER,
    queue: QueueConstants.QUEUE_SUBFINDER,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
    createQueueIfNotExists: true,
  })
  async handleSubfinderJob(data: SubfinderJobData): Promise<void | Nack> {
    const startTime = Date.now();
    const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
    this.logger.log(`[${workerId}] Processing: ${data.domain} (batch: ${data.batchId || 'none'})`);

    try {
      const result = await this.runSubfinder(data.domain, data.domainId);
      
      const duration = Date.now() - startTime;
      this.logger.log(
        `[${workerId}] ✓ ${data.domain}: ${result.total} subdomains (${result.created} new, ${result.updated} updated) in ${duration}ms`,
      );
    } catch (error: any) {
      this.logger.error(`[${workerId}] ✗ ${data.domain}: ${error.message}`);
      // Return Nack to requeue on failure (with requeue=false to send to DLQ)
      return new Nack(false);
    }
  }

  private async runSubfinder(domain: string, domainId: string): Promise<SubfinderResult> {
    const startTime = Date.now();

    try {
      // Extract root domain
      const rootDomain = this.extractRootDomain(domain);
      
      // Run subfinder command
      const subdomains = await this.executeSubfinder(rootDomain);
      
      // Get or verify domain document
      let domainDoc = await this.domainModel.findById(domainId);
      if (!domainDoc) {
        domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
      }
      
      if (!domainDoc) {
        throw new Error(`Domain not found: ${domain}`);
      }

      // Save subdomains
      let created = 0;
      let updated = 0;

      for (const subdomain of subdomains) {
        try {
          const existing = await this.subdomainModel.findOne({
            subdomain: subdomain.toLowerCase(),
          });

          if (existing) {
            const sources = existing.sources || [];
            if (!sources.includes(this.source)) {
              sources.push(this.source);
            }
            await this.subdomainModel.updateOne(
              { _id: existing._id },
              { $set: { lastSeen: new Date(), isNew: false, sources } },
            );
            updated++;
          } else {
            await this.subdomainModel.create({
              subdomain: subdomain.toLowerCase(),
              domainId: domainDoc._id,
              firstSeen: new Date(),
              lastSeen: new Date(),
              isNew: true,
              isAlive: false,
              sources: [this.source],
            });
            created++;
          }
        } catch (e: any) {
          if (!e.message?.includes('duplicate')) {
            this.logger.warn(`Failed to save subdomain ${subdomain}: ${e.message}`);
          }
        }
      }

      // Update domain subdomain count
      const totalCount = await this.subdomainModel.countDocuments({
        domainId: domainDoc._id,
      });
      await this.domainModel.findByIdAndUpdate(domainDoc._id, {
        subdomainCount: totalCount,
      });

      return {
        domain,
        success: true,
        total: subdomains.length,
        created,
        updated,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        domain,
        success: false,
        total: 0,
        created: 0,
        updated: 0,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private extractRootDomain(domain: string): string {
    let d = domain.toLowerCase().replace(/^www\./, '');
    const parts = d.split('.');
    if (parts.length <= 2) return d;
    
    const secondLevelTlds = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
    if (parts.length >= 3 && secondLevelTlds.includes(parts[parts.length - 2])) {
      return parts.slice(-3).join('.');
    }
    
    return parts.slice(-2).join('.');
  }

  private async executeSubfinder(domain: string): Promise<string[]> {
    const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
    
    try {
      // Use local subfinder binary (installed in container)
      const { stdout, stderr } = await execAsync(
        `subfinder -d ${domain} -all -silent`,
        { timeout: 300000 },
      );
      
      if (stderr && !stderr.includes('INF')) {
        this.logger.debug(`[${workerId}] Subfinder stderr for ${domain}: ${stderr.substring(0, 200)}`);
      }
      
      const subdomains = stdout.split('\n').map(s => s.trim()).filter(Boolean);
      this.logger.debug(`[${workerId}] Subfinder found ${subdomains.length} subdomains for ${domain}`);
      
      return subdomains;
    } catch (error: any) {
      if (error.message?.includes('not found') || error.code === 127) {
        this.logger.error(`[${workerId}] Subfinder not installed`);
        return [];
      }
      // Log timeout errors but don't throw
      if (error.killed || error.message?.includes('timeout')) {
        this.logger.warn(`[${workerId}] Subfinder timeout for ${domain}`);
        return [];
      }
      throw error;
    }
  }
}
