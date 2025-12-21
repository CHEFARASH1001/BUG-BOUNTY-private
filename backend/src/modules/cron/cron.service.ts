import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobExecution, JobExecutionDocument, JobStatus } from './schemas/job-execution.schema';
import { CronConfig, CronConfigDocument } from './schemas/cron-config.schema';
import { QueueService } from '../queue/queue.service';
import { PlatformSyncService } from '../platforms/platform-sync.service';
import { LivesService } from '../lives/lives.service';
import { HttpServicesService } from '../http-services/http-services.service';
import { ScoresService } from '../scores/scores.service';
import { DomainsService } from '../domains/domains.service';
import { SubdomainsService } from '../subdomains/subdomains.service';
import { ReconService } from '../recon/recon.service';

export interface JobDefinition {
  name: string;
  schedule: string;
  description: string;
}

export type LogFn = (message: string) => Promise<void>;

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private readonly jobDefinitions: JobDefinition[] = [
    {
      name: 'watch_sync_programs',
      schedule: '0 */6 * * *',
      description: 'Sync programs from bug bounty platforms',
    },
    {
      name: 'watch_enum_all',
      schedule: '0 */12 * * *',
      description: 'Full subdomain enumeration for all domains',
    },
    {
      name: 'watch_ns_all',
      schedule: '0 */4 * * *',
      description: 'DNS resolution for all subdomains',
    },
    {
      name: 'watch_http_all',
      schedule: '0 */2 * * *',
      description: 'HTTP probing for all live hosts',
    },
    {
      name: 'watch_nuclei_all',
      schedule: '0 0 * * *',
      description: 'Nuclei vulnerability scanning',
    },
    {
      name: 'fresh_detection',
      schedule: '*/30 * * * *',
      description: 'Mark old assets as not fresh',
    },
    {
      name: 'score_calculation',
      schedule: '0 2 * * *',
      description: 'Recalculate all scores',
    },
  ];

  constructor(
    @InjectModel(JobExecution.name) private jobExecutionModel: Model<JobExecutionDocument>,
    @InjectModel(CronConfig.name) private cronConfigModel: Model<CronConfigDocument>,
    private queueService: QueueService,
    @Inject(forwardRef(() => PlatformSyncService)) private platformSyncService: PlatformSyncService,
    @Inject(forwardRef(() => LivesService)) private livesService: LivesService,
    @Inject(forwardRef(() => HttpServicesService)) private httpServicesService: HttpServicesService,
    @Inject(forwardRef(() => ScoresService)) private scoresService: ScoresService,
    @Inject(forwardRef(() => DomainsService)) private domainsService: DomainsService,
    @Inject(forwardRef(() => SubdomainsService)) private subdomainsService: SubdomainsService,
    @Inject(forwardRef(() => ReconService)) private reconService: ReconService,
  ) {}

  async onModuleInit() {
    await this.initializeConfigs();
  }

  private async initializeConfigs() {
    this.logger.log('Initializing cron job configurations...');

    for (const job of this.jobDefinitions) {
      await this.cronConfigModel.updateOne(
        { jobName: job.name },
        {
          $setOnInsert: {
            jobName: job.name,
            schedule: job.schedule,
            description: job.description,
            enabled: true,
          },
        },
        { upsert: true },
      );
    }

    this.logger.log(`Initialized ${this.jobDefinitions.length} cron job configurations`);
  }

  // Scheduled jobs using decorators
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledProgramSync() {
    await this.runJobIfEnabled('watch_sync_programs', (log) => this.runProgramSync(log));
  }

  @Cron('0 */12 * * *') // Every 12 hours
  async scheduledEnumAll() {
    await this.runJobIfEnabled('watch_enum_all', (log) => this.runEnumAll(log));
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledDnsAll() {
    await this.runJobIfEnabled('watch_ns_all', (log) => this.runDnsAll(log));
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async scheduledHttpAll() {
    await this.runJobIfEnabled('watch_http_all', (log) => this.runHttpAll(log));
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledNucleiAll() {
    await this.runJobIfEnabled('watch_nuclei_all', (log) => this.runNucleiAll(log));
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledFreshDetection() {
    await this.runJobIfEnabled('fresh_detection', (log) => this.runFreshDetection(log));
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledScoreCalculation() {
    await this.runJobIfEnabled('score_calculation', (log) => this.runScoreCalculation(log));
  }

  private async runJobIfEnabled(
    jobName: string,
    handler: (log: LogFn) => Promise<any>,
  ): Promise<void> {
    const config = await this.cronConfigModel.findOne({ jobName });
    if (!config?.enabled) {
      return;
    }

    await this.executeJob(jobName, handler, 'scheduled');
  }

  async executeJob(
    jobName: string,
    handler: (log: LogFn) => Promise<any>,
    trigger = 'manual',
  ): Promise<JobExecutionDocument> {
    const execution = await this.jobExecutionModel.create({
      jobName,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
      trigger,
      logs: [],
    });

    const addLog = async (message: string) => {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}`;
      // Only push to database, don't add to in-memory to avoid duplication on save()
      await this.jobExecutionModel.updateOne(
        { _id: execution._id },
        { $push: { logs: logEntry } },
      );
      this.logger.log(`[${jobName}] ${message}`);
    };

    await addLog(`Starting job: ${jobName} (trigger: ${trigger})`);

    try {
      const result = await handler(addLog);
      
      const completedAt = new Date();
      const duration = completedAt.getTime() - execution.startedAt.getTime();

      await addLog(`Job completed successfully in ${duration}ms`);

      // Use updateOne to avoid overwriting logs
      await this.jobExecutionModel.updateOne(
        { _id: execution._id },
        {
          $set: {
            status: JobStatus.COMPLETED,
            completedAt,
            duration,
            result,
          },
        },
      );

      // Update config
      await this.cronConfigModel.updateOne(
        { jobName },
        {
          $set: { lastRunAt: new Date() },
          $inc: { runCount: 1 },
        },
      );

      // Refresh execution for return value
      const updatedExecution = await this.jobExecutionModel.findById(execution._id);
      return updatedExecution || execution;
    } catch (error: any) {
      await addLog(`ERROR: ${error.message}`);
      
      // Use updateOne to avoid overwriting logs
      await this.jobExecutionModel.updateOne(
        { _id: execution._id },
        {
          $set: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            duration: new Date().getTime() - execution.startedAt.getTime(),
            error: error.message,
          },
        },
      );

      // Update config
      await this.cronConfigModel.updateOne(
        { jobName },
        {
          $set: { lastRunAt: new Date() },
          $inc: { runCount: 1, failCount: 1 },
        },
      );

      this.logger.error(`Failed job: ${jobName}: ${error.message}`);
      
      // Refresh execution for return value
      const updatedExecution = await this.jobExecutionModel.findById(execution._id);
      return updatedExecution || execution;
    }
  }

  async getExecutionLogs(executionId: string): Promise<string[]> {
    const execution = await this.jobExecutionModel.findById(executionId).exec();
    return execution?.logs || [];
  }

  async getConfigs(): Promise<CronConfigDocument[]> {
    return this.cronConfigModel.find().exec();
  }

  async getConfig(jobName: string): Promise<CronConfigDocument | null> {
    return this.cronConfigModel.findOne({ jobName }).exec();
  }

  async updateConfig(jobName: string, updates: Partial<CronConfig>): Promise<CronConfigDocument | null> {
    return this.cronConfigModel.findOneAndUpdate(
      { jobName },
      { $set: updates },
      { new: true },
    );
  }

  async triggerJob(jobName: string): Promise<JobExecutionDocument> {
    const handlers: Record<string, (log: LogFn) => Promise<any>> = {
      watch_sync_programs: (log) => this.runProgramSync(log),
      watch_enum_all: (log) => this.runEnumAll(log),
      watch_ns_all: (log) => this.runDnsAll(log),
      watch_http_all: (log) => this.runHttpAll(log),
      watch_nuclei_all: (log) => this.runNucleiAll(log),
      fresh_detection: (log) => this.runFreshDetection(log),
      score_calculation: (log) => this.runScoreCalculation(log),
    };

    const handler = handlers[jobName];
    if (!handler) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    return this.executeJob(jobName, handler, 'manual');
  }

  async getExecutions(
    jobName?: string,
    limit = 20,
  ): Promise<JobExecutionDocument[]> {
    const query = jobName ? { jobName } : {};
    return this.jobExecutionModel
      .find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }

  async getRunningJobs(): Promise<JobExecutionDocument[]> {
    return this.jobExecutionModel.find({ status: JobStatus.RUNNING }).exec();
  }

  // Job handlers
  private async runProgramSync(log: LogFn): Promise<any> {
    await log('Starting platform synchronization...');
    await log('Fetching programs from HackerOne...');
    
    try {
      const result = await this.platformSyncService.syncAllPlatforms(log);
      await log(`Sync completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error: any) {
      await log(`Sync error: ${error.message}`);
      throw error;
    }
  }

  private async runEnumAll(log: LogFn): Promise<any> {
    await log('Starting subdomain enumeration for all domains...');
    
    // Get all domains from database
    const domains = await this.domainsService.findAll({});
    await log(`Found ${domains.length} domains to enumerate`);
    
    if (domains.length === 0) {
      await log('No domains found. Run program sync first.');
      return { message: 'No domains to enumerate', enumerated: 0 };
    }

    let totalSubdomains = 0;
    let processed = 0;
    const maxDomains = 10; // Limit for dev mode

    for (const domain of domains.slice(0, maxDomains)) {
      try {
        await log(`Enumerating subdomains for: ${domain.domain}`);
        const subdomains = await this.reconService.enumerateSubdomains(domain.domain);
        await log(`Found ${subdomains.length} subdomains for ${domain.domain}`);
        
        // Save subdomains to database
        for (const subdomain of subdomains) {
          try {
            await this.subdomainsService.create({
              subdomain,
              domainId: domain._id.toString(),
              isAlive: false, // Will be resolved later
            });
          } catch (e: any) {
            // Ignore duplicates
            if (!e.message?.includes('duplicate')) {
              this.logger.warn(`Failed to save subdomain ${subdomain}: ${e.message}`);
            }
          }
        }
        
        totalSubdomains += subdomains.length;
        processed++;
      } catch (error: any) {
        await log(`Error enumerating ${domain.domain}: ${error.message}`);
      }
    }

    await log(`Enumeration complete: ${totalSubdomains} subdomains found across ${processed} domains`);
    return { message: 'Enumeration completed', totalSubdomains, domainsProcessed: processed };
  }

  private async runDnsAll(log: LogFn): Promise<any> {
    await log('Starting DNS resolution for all subdomains...');
    
    const subdomains = await this.subdomainsService.findAll({ isAlive: undefined });
    await log(`Found ${subdomains.length} subdomains to resolve`);
    
    if (subdomains.length === 0) {
      await log('No subdomains found. Run enumeration first.');
      return { message: 'No subdomains to resolve', resolved: 0 };
    }

    let alive = 0;
    let dead = 0;
    const dns = require('dns').promises;
    const maxSubdomains = 100; // Limit for dev mode

    for (const sub of subdomains.slice(0, maxSubdomains)) {
      try {
        const addresses = await dns.resolve(sub.subdomain);
        await this.subdomainsService.update(sub._id.toString(), {
          isAlive: true,
          ip: addresses,
        });
        alive++;
      } catch {
        await this.subdomainsService.update(sub._id.toString(), { isAlive: false });
        dead++;
      }
    }

    await log(`DNS resolution complete: ${alive} alive, ${dead} dead`);
    return { message: 'DNS resolution completed', alive, dead };
  }

  private async runHttpAll(log: LogFn): Promise<any> {
    await log('Starting HTTP probing for all live hosts...');
    
    const subdomains = await this.subdomainsService.findAll({ isAlive: true });
    await log(`Found ${subdomains.length} alive subdomains to probe`);
    
    if (subdomains.length === 0) {
      await log('No alive subdomains found. Run DNS resolution first.');
      return { message: 'No subdomains to probe', probed: 0 };
    }

    let probed = 0;
    const maxSubdomains = 50; // Limit for dev mode
    const axios = require('axios');

    for (const sub of subdomains.slice(0, maxSubdomains)) {
      try {
        const response = await axios.get(`https://${sub.subdomain}`, {
          timeout: 5000,
          validateStatus: () => true,
          maxRedirects: 3,
        });
        
        await this.subdomainsService.update(sub._id.toString(), {
          httpStatus: response.status,
          title: this.extractTitle(response.data),
        });
        probed++;
        await log(`Probed ${sub.subdomain}: HTTP ${response.status}`);
      } catch (error: any) {
        // Try HTTP fallback
        try {
          const response = await axios.get(`http://${sub.subdomain}`, {
            timeout: 5000,
            validateStatus: () => true,
            maxRedirects: 3,
          });
          
          await this.subdomainsService.update(sub._id.toString(), {
            httpStatus: response.status,
            title: this.extractTitle(response.data),
          });
          probed++;
        } catch {
          // Host not responding
        }
      }
    }

    await log(`HTTP probing complete: ${probed} hosts probed`);
    return { message: 'HTTP probing completed', probed };
  }

  private extractTitle(html: string): string | undefined {
    const match = html?.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim().substring(0, 200) : undefined;
  }

  private async runNucleiAll(log: LogFn): Promise<any> {
    await log('Starting Nuclei vulnerability scanning...');
    await log('Note: Nuclei requires external tool installation');
    
    const subdomains = await this.subdomainsService.findAll({ isAlive: true });
    await log(`Found ${subdomains.length} alive subdomains for scanning`);
    
    // In dev mode, just log the targets
    await log('Nuclei scanning requires the nuclei binary. Skipping in dev mode.');
    
    return { 
      message: 'Nuclei scan skipped (dev mode)', 
      targets: subdomains.length,
      note: 'Install nuclei binary for production scanning' 
    };
  }

  private async runFreshDetection(log: LogFn): Promise<any> {
    await log('Starting fresh detection...');
    await log('Marking stale live hosts (older than 24h)...');
    
    const [livesMarked, httpMarked] = await Promise.all([
      this.livesService.markAsNotFresh(24),
      this.httpServicesService.markAsNotFresh(24),
    ]);

    await log(`Marked ${livesMarked} live hosts as not fresh`);
    await log(`Marked ${httpMarked} HTTP services as not fresh`);

    return {
      livesMarked,
      httpMarked,
    };
  }

  private async runScoreCalculation(log: LogFn): Promise<any> {
    await log('Starting score calculation for all assets...');
    const result = await this.scoresService.calculateAllScores();
    await log(`Score calculation completed`);
    return result;
  }
}
