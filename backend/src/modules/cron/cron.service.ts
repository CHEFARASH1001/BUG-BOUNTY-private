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
import { CliService } from '../cli/cli.service';
import { HttpMonitorService } from '../http-services/http-monitor.service';
import { AbuseIPDBService } from '../external-apis/services/abuseipdb.service';
import { CTService } from '../recon/services/ct.service';
import { AlertService } from '../alerts/alert.service';

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
      name: 'watch_subfinder_all',
      schedule: '0 */8 * * *',
      description: 'Run subfinder for all domains',
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
      name: 'watch_live_all',
      schedule: '0 */3 * * *',
      description: 'Live subdomain detection with dnsx (IPs, CDN, CNAME)',
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
    {
      name: 'watch_http_monitor',
      schedule: '0 */1 * * *',
      description: 'HTTP monitoring with change detection and alerts',
    },
    {
      name: 'watch_abuseipdb',
      schedule: '0 */6 * * *',
      description: 'AbuseIPDB IP reputation checks for watched domains',
    },
    {
      name: 'watch_ct_logs',
      schedule: '0 */4 * * *',
      description: 'Certificate Transparency log monitoring for new subdomains',
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
    @Inject(forwardRef(() => CliService)) private cliService: CliService,
    @Inject(forwardRef(() => HttpMonitorService)) private httpMonitorService: HttpMonitorService,
    @Inject(forwardRef(() => AbuseIPDBService)) private abuseIPDBService: AbuseIPDBService,
    @Inject(forwardRef(() => CTService)) private ctService: CTService,
    @Inject(forwardRef(() => AlertService)) private alertService: AlertService,
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

  @Cron('0 */8 * * *') // Every 8 hours
  async scheduledSubfinderAll() {
    await this.runJobIfEnabled('watch_subfinder_all', (log) => this.runSubfinderAll(log));
  }

  @Cron('0 */12 * * *') // Every 12 hours
  async scheduledEnumAll() {
    await this.runJobIfEnabled('watch_enum_all', (log) => this.runEnumAll(log));
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledDnsAll() {
    await this.runJobIfEnabled('watch_ns_all', (log) => this.runDnsAll(log));
  }

  @Cron('0 */3 * * *') // Every 3 hours
  async scheduledLiveAll() {
    await this.runJobIfEnabled('watch_live_all', (log) => this.runLiveAll(log));
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

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledHttpMonitor() {
    await this.runJobIfEnabled('watch_http_monitor', (log) => this.runHttpMonitor(log));
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledAbuseIPDBWatch() {
    await this.runJobIfEnabled('watch_abuseipdb', (log) => this.runAbuseIPDBWatch(log));
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledCTMonitor() {
    await this.runJobIfEnabled('watch_ct_logs', (log) => this.runCTMonitor(log));
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
      watch_subfinder_all: (log) => this.runSubfinderAll(log),
      watch_enum_all: (log) => this.runEnumAll(log),
      watch_ns_all: (log) => this.runDnsAll(log),
      watch_live_all: (log) => this.runLiveAll(log),
      watch_http_all: (log) => this.runHttpAll(log),
      watch_nuclei_all: (log) => this.runNucleiAll(log),
      fresh_detection: (log) => this.runFreshDetection(log),
      score_calculation: (log) => this.runScoreCalculation(log),
      watch_http_monitor: (log) => this.runHttpMonitor(log),
      watch_abuseipdb: (log) => this.runAbuseIPDBWatch(log),
      watch_ct_logs: (log) => this.runCTMonitor(log),
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

  /**
   * Mark stale running jobs as failed
   * Jobs that have been running longer than maxAgeMs are considered stale
   */
  async markStaleJobsAsFailed(maxAgeMs: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    
    const result = await this.jobExecutionModel.updateMany(
      {
        status: JobStatus.RUNNING,
        startedAt: { $lt: cutoffTime },
      },
      {
        $set: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          error: 'Job marked as failed due to timeout (stale)',
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.warn(`Marked ${result.modifiedCount} stale job(s) as failed`);
    }

    return result.modifiedCount;
  }

  /**
   * Cancel a running job
   */
  async cancelJob(executionId: string): Promise<JobExecutionDocument | null> {
    const execution = await this.jobExecutionModel.findById(executionId);
    
    if (!execution || execution.status !== JobStatus.RUNNING) {
      return null;
    }

    execution.status = JobStatus.FAILED;
    execution.completedAt = new Date();
    execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    execution.error = 'Job cancelled by user';
    
    await execution.save();
    
    this.logger.log(`Cancelled job: ${execution.jobName} (${executionId})`);
    
    return execution;
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

  private async runSubfinderAll(log: LogFn): Promise<any> {
    await log('Starting subfinder for all domains (parallel via RabbitMQ)...');
    
    // Get all domains from database
    const domainsResult = await this.domainsService.findAll({ limit: 10000 });
    const domains = domainsResult.data;
    await log(`Found ${domains.length} domains to scan with subfinder`);
    
    if (domains.length === 0) {
      await log('No domains found. Add domains first.');
      return { message: 'No domains to scan', scanned: 0 };
    }

    // Generate batch ID for tracking
    const batchId = `subfinder-${Date.now()}`;
    await log(`Batch ID: ${batchId}`);
    
    // Publish all domains to the queue for parallel processing
    const domainJobs = domains.map(d => ({
      domain: d.domain,
      domainId: d._id.toString(),
    }));
    
    const published = await this.queueService.publishSubfinderBatch(domainJobs, batchId);
    
    await log(`✓ Published ${published} domains to subfinder queue`);
    await log(`Workers will process domains in parallel`);
    await log(`Monitor progress in RabbitMQ: http://localhost:15672`);

    return {
      message: 'Subfinder jobs queued for parallel processing',
      batchId,
      domainsTotal: domains.length,
      domainsQueued: published,
      note: 'Jobs are being processed by workers in parallel. Check RabbitMQ for progress.',
    };
  }

  private async runEnumAll(log: LogFn): Promise<any> {
    await log('Starting subdomain enumeration for all domains...');
    
    // Get all domains from database
    const domainsResult = await this.domainsService.findAll({ limit: 1000 });
    const domains = domainsResult.data;
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
    
    const subdomainsResult = await this.subdomainsService.findAll({ limit: 10000 });
    const subdomains = subdomainsResult.data;
    await log(`Found ${subdomains.length} subdomains to resolve`);
    
    if (subdomains.length === 0) {
      await log('No subdomains found. Run enumeration first.');
      return { message: 'No subdomains to resolve', resolved: 0 };
    }

    let alive = 0;
    let dead = 0;
    const dns = require('dns').promises;

    // Process in batches to avoid overwhelming DNS
    const batchSize = 50;
    const totalBatches = Math.ceil(subdomains.length / batchSize);
    
    for (let i = 0; i < subdomains.length; i += batchSize) {
      const batch = subdomains.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      await log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} subdomains)`);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          try {
            const addresses = await dns.resolve(sub.subdomain);
            await this.subdomainsService.update(sub._id.toString(), {
              isAlive: true,
              ip: addresses,
            });
            return { alive: true };
          } catch {
            await this.subdomainsService.update(sub._id.toString(), { isAlive: false });
            return { alive: false };
          }
        })
      );
      
      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.alive) {
            alive++;
          } else {
            dead++;
          }
        } else {
          dead++;
        }
      }
    }

    await log(`DNS resolution complete: ${alive} alive, ${dead} dead`);
    return { message: 'DNS resolution completed', alive, dead, total: subdomains.length };
  }

  private async runLiveAll(log: LogFn): Promise<any> {
    await log('Starting live subdomain detection for all domains...');

    // Get domains that have subdomains (subdomainCount > 0)
    const domainsResult = await this.domainsService.findAll({ 
      limit: 100, 
      hasSubdomains: true,
      sortBy: 'subdomainCount',
      sortOrder: 'desc',
    });
    const domains = domainsResult.data;
    await log(`Found ${domains.length} domains with subdomains to process`);

    if (domains.length === 0) {
      await log('No domains with subdomains found. Run enumeration first.');
      return { message: 'No domains with subdomains to process', success: false };
    }

    // Check subdomains count
    const subdomainsResult = await this.subdomainsService.findAll({ limit: 1 });
    await log(`Total subdomains in database: ${subdomainsResult.pagination.total}`);

    if (subdomainsResult.pagination.total === 0) {
      await log('No subdomains found. Run enumeration first (watch_subfinder_all).');
      return { message: 'No subdomains to process', success: false };
    }

    const result = await this.cliService.watchLiveAll();

    if (!result.success) {
      await log(`Live detection failed: ${result.message}`);
      return { message: result.message, success: false };
    }

    await log(
      `Live detection complete: ${result.results?.totalAlive || 0} alive (${result.results?.totalCreated || 0} new, ${result.results?.totalUpdated || 0} updated)`,
    );
    await log(`Domains with subdomains: ${result.results?.domainsWithSubdomains || 0}/${domains.length}`);
    await log(`Dead subdomains: ${result.results?.totalDead || 0}`);

    // Send notification for new live subdomains
    if (result.results?.newLives && result.results.newLives.length > 0) {
      await log(`New live subdomains found: ${result.results.newLives.length}`);
      try {
        await this.queueService.publishNotification({
          type: 'new_live',
          data: {
            count: result.results.newLives.length,
            subdomains: result.results.newLives.slice(0, 20),
            timestamp: new Date(),
          },
          channels: ['discord', 'telegram'],
        });
        await log('Notification sent for new live subdomains');
      } catch (e: any) {
        await log(`Failed to send notification: ${e.message}`);
      }
    }

    return result.results;
  }

  private async runHttpAll(log: LogFn): Promise<any> {
    await log('Starting HTTP probing for all live hosts...');
    
    const subdomainsResult = await this.subdomainsService.findAll({ isAlive: true, limit: 500 });
    const subdomains = subdomainsResult.data;
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
    
    const subdomainsResult = await this.subdomainsService.findAll({ isAlive: true, limit: 1000 });
    const subdomains = subdomainsResult.data;
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

  /**
   * HTTP Monitoring with change detection and alerts
   * Probes all HTTP services and detects changes in status code, title, technologies, favicon
   * Triggers alerts for detected changes based on configured alert rules
   * Requirements: 8.1, 8.2, 8.3
   */
  private async runHttpMonitor(log: LogFn): Promise<any> {
    await log('Starting HTTP monitoring with change detection...');

    try {
      // Watch all HTTP services for changes
      const result = await this.httpMonitorService.watchAll();
      
      await log(`Probed ${result.probed} HTTP services`);
      await log(`Created ${result.created} new services, updated ${result.updated} existing`);
      await log(`Detected ${result.changes.length} changes`);

      // Process each change event through the alert service
      if (result.changes.length > 0) {
        await log('Processing change events for alerts...');
        
        for (const change of result.changes) {
          try {
            await this.alertService.processHTTPChangeEvent(change);
            await log(`Processed alert for ${change.changeType} change on ${change.url}`);
          } catch (error: any) {
            await log(`Failed to process alert for ${change.url}: ${error.message}`);
          }
        }

        // Send summary notification
        try {
          await this.queueService.publishNotification({
            type: 'status_change',
            data: {
              totalChanges: result.changes.length,
              statusCodeChanges: result.changes.filter(c => c.changeType === 'status_code').length,
              titleChanges: result.changes.filter(c => c.changeType === 'title').length,
              techChanges: result.changes.filter(c => c.changeType === 'technology').length,
              faviconChanges: result.changes.filter(c => c.changeType === 'favicon').length,
              changes: result.changes.slice(0, 10), // First 10 changes for notification
              timestamp: new Date(),
            },
            channels: ['discord', 'telegram'],
          });
          await log('Summary notification sent');
        } catch (e: any) {
          await log(`Failed to send summary notification: ${e.message}`);
        }
      }

      return {
        message: 'HTTP monitoring completed',
        probed: result.probed,
        created: result.created,
        updated: result.updated,
        changesDetected: result.changes.length,
      };
    } catch (error: any) {
      await log(`HTTP monitoring error: ${error.message}`);
      throw error;
    }
  }

  /**
   * AbuseIPDB watching for IP reputation checks
   * Checks IPs associated with watched domains for abuse reports
   * Triggers alerts for high abuse scores
   * Requirements: 1.4
   */
  private async runAbuseIPDBWatch(log: LogFn): Promise<any> {
    await log('Starting AbuseIPDB IP reputation checks...');

    // Check if AbuseIPDB is configured
    if (!this.abuseIPDBService.isConfigured()) {
      await log('AbuseIPDB API key not configured. Skipping.');
      return { message: 'AbuseIPDB not configured', checked: 0 };
    }

    try {
      // Get all alive subdomains with IP addresses
      const subdomainsResult = await this.subdomainsService.findAll({ 
        isAlive: true, 
        limit: 500 
      });
      const subdomains = subdomainsResult.data;
      await log(`Found ${subdomains.length} alive subdomains to check`);

      if (subdomains.length === 0) {
        await log('No alive subdomains found.');
        return { message: 'No subdomains to check', checked: 0 };
      }

      // Extract unique IPs from subdomains
      const ipSet = new Set<string>();
      const ipToSubdomain = new Map<string, any>();
      
      for (const sub of subdomains) {
        const ips = sub.ip || [];
        for (const ip of ips) {
          if (ip && !ipSet.has(ip)) {
            ipSet.add(ip);
            ipToSubdomain.set(ip, sub);
          }
        }
      }

      const uniqueIPs = Array.from(ipSet);
      await log(`Found ${uniqueIPs.length} unique IPs to check`);

      if (uniqueIPs.length === 0) {
        await log('No IPs found in subdomains.');
        return { message: 'No IPs to check', checked: 0 };
      }

      // Check IPs (limit to avoid rate limiting)
      const maxIPs = 50;
      const ipsToCheck = uniqueIPs.slice(0, maxIPs);
      let checked = 0;
      let highAbuseCount = 0;
      const abuseThreshold = 50; // Default threshold for high abuse score

      for (const ip of ipsToCheck) {
        try {
          const result = await this.abuseIPDBService.checkIP(ip);
          checked++;

          // Store the result
          const subdomain = ipToSubdomain.get(ip);
          await this.abuseIPDBService.storeResult(result, {
            subdomainId: subdomain?._id,
            domainId: subdomain?.domainId,
          });

          // Check if abuse score exceeds threshold
          if (this.abuseIPDBService.exceedsThreshold(result.abuseConfidenceScore, abuseThreshold)) {
            highAbuseCount++;
            await log(`⚠️ High abuse score for ${ip}: ${result.abuseConfidenceScore}%`);

            // Process abuse score alert
            try {
              await this.alertService.processAbuseScoreEvent({
                ipAddress: ip,
                abuseConfidenceScore: result.abuseConfidenceScore,
                domain: subdomain?.subdomain,
                detectedAt: new Date(),
              });
            } catch (alertError: any) {
              await log(`Failed to process abuse alert for ${ip}: ${alertError.message}`);
            }
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          await log(`Failed to check IP ${ip}: ${error.message}`);
        }
      }

      await log(`AbuseIPDB check complete: ${checked} IPs checked, ${highAbuseCount} with high abuse scores`);

      return {
        message: 'AbuseIPDB check completed',
        checked,
        highAbuseCount,
        totalIPs: uniqueIPs.length,
      };
    } catch (error: any) {
      await log(`AbuseIPDB watch error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Certificate Transparency log monitoring
   * Queries CT logs for watched domains and discovers new subdomains
   * Triggers alerts for newly discovered subdomains
   * Requirements: 4.1, 4.4
   */
  private async runCTMonitor(log: LogFn): Promise<any> {
    await log('Starting Certificate Transparency log monitoring...');

    try {
      // Get all domains to monitor
      const domainsResult = await this.domainsService.findAll({ limit: 100 });
      const domains = domainsResult.data;
      await log(`Found ${domains.length} domains to monitor for CT logs`);

      if (domains.length === 0) {
        await log('No domains found. Add domains first.');
        return { message: 'No domains to monitor', discovered: 0 };
      }

      let totalDiscovered = 0;
      let totalNew = 0;
      const maxDomains = 20; // Limit to avoid overwhelming crt.sh

      for (const domain of domains.slice(0, maxDomains)) {
        try {
          await log(`Querying CT logs for: ${domain.domain}`);
          
          const ctResult = await this.ctService.queryDomain(domain.domain);
          await log(`Found ${ctResult.subdomains.length} subdomains from CT logs for ${domain.domain}`);
          
          totalDiscovered += ctResult.subdomains.length;

          // Create subdomain records with cert_trans source
          const records = this.ctService.createSubdomainRecords(
            ctResult.subdomains,
            domain._id.toString(),
          );

          // Save new subdomains
          let newCount = 0;
          for (const record of records) {
            try {
              // Check if subdomain already exists
              const existing = await this.subdomainsService.findBySubdomain(record.subdomain);
              
              if (!existing) {
                await this.subdomainsService.create({
                  subdomain: record.subdomain,
                  domainId: record.domainId,
                  sources: [record.source],
                  isAlive: false, // Will be resolved later
                });
                newCount++;
              }
            } catch (e: any) {
              // Ignore duplicates
              if (!e.message?.includes('duplicate')) {
                this.logger.warn(`Failed to save CT subdomain ${record.subdomain}: ${e.message}`);
              }
            }
          }

          if (newCount > 0) {
            await log(`Added ${newCount} new subdomains from CT logs for ${domain.domain}`);
            totalNew += newCount;

            // Send notification for new CT discoveries
            try {
              await this.queueService.publishNotification({
                type: 'new_subdomain',
                data: {
                  domain: domain.domain,
                  source: 'cert_trans',
                  count: newCount,
                  subdomains: records.slice(0, 10).map(r => r.subdomain),
                  timestamp: new Date(),
                },
                channels: ['discord', 'telegram'],
              });
            } catch (notifyError: any) {
              await log(`Failed to send CT notification: ${notifyError.message}`);
            }
          }

          // Rate limiting - wait between requests to crt.sh
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          await log(`Error querying CT logs for ${domain.domain}: ${error.message}`);
        }
      }

      await log(`CT monitoring complete: ${totalDiscovered} subdomains found, ${totalNew} new`);

      return {
        message: 'CT monitoring completed',
        domainsChecked: Math.min(domains.length, maxDomains),
        totalDiscovered,
        newSubdomains: totalNew,
      };
    } catch (error: any) {
      await log(`CT monitoring error: ${error.message}`);
      throw error;
    }
  }
}
