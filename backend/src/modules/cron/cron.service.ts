import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobExecution, JobExecutionDocument, JobStatus } from './schemas/job-execution.schema';
import { CronConfig, CronConfigDocument } from './schemas/cron-config.schema';
import { QueueService } from '../queue/queue.service';
import { PlatformSyncService } from '../platforms/platform-sync.service';
import { LivesService } from '../lives/lives.service';

import { ScoresService } from '../scores/scores.service';
import { DomainsService } from '../domains/domains.service';
import { SubdomainsService } from '../subdomains/subdomains.service';
import { ReconService } from '../recon/recon.service';
import { CliService } from '../cli/cli.service';

import { AbuseIPDBService } from '../external-apis/services/abuseipdb.service';
import { CTService } from '../recon/services/ct.service';
import { AlertService } from '../alerts/alert.service';
import { WaybackService } from '../recon/services/wayback.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { NucleiService } from '../scanner/services/nuclei.service';
import { DNSBruteService } from '../recon/services/dns-brute.service';

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
      description: 'Run subfinder for all domains (parallel)',
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
      name: 'watch_abuseipdb',
      schedule: '0 */6 * * *',
      description: 'AbuseIPDB IP reputation checks for watched domains',
    },
    {
      name: 'watch_ct_logs',
      schedule: '0 */4 * * *',
      description: 'Certificate Transparency log monitoring for new subdomains',
    },
    {
      name: 'watch_wayback',
      schedule: '0 */8 * * *',
      description: 'Waybackurls endpoint discovery for alive subdomains',
    },
    {
      name: 'watch_dns_brute',
      schedule: '0 0 * * *',
      description: 'DNS brute forcing for watched domains',
    },
  ];

  constructor(
    @InjectModel(JobExecution.name) private jobExecutionModel: Model<JobExecutionDocument>,
    @InjectModel(CronConfig.name) private cronConfigModel: Model<CronConfigDocument>,
    private queueService: QueueService,
    @Inject(forwardRef(() => PlatformSyncService)) private platformSyncService: PlatformSyncService,
    @Inject(forwardRef(() => LivesService)) private livesService: LivesService,

    @Inject(forwardRef(() => ScoresService)) private scoresService: ScoresService,
    @Inject(forwardRef(() => DomainsService)) private domainsService: DomainsService,
    @Inject(forwardRef(() => SubdomainsService)) private subdomainsService: SubdomainsService,
    @Inject(forwardRef(() => ReconService)) private reconService: ReconService,
    @Inject(forwardRef(() => CliService)) private cliService: CliService,

    @Inject(forwardRef(() => AbuseIPDBService)) private abuseIPDBService: AbuseIPDBService,
    @Inject(forwardRef(() => CTService)) private ctService: CTService,
    @Inject(forwardRef(() => AlertService)) private alertService: AlertService,
    @Inject(forwardRef(() => WaybackService)) private waybackService: WaybackService,
    @Inject(forwardRef(() => EndpointsService)) private endpointsService: EndpointsService,
    @Inject(forwardRef(() => NucleiService)) private nucleiService: NucleiService,
    @Inject(forwardRef(() => DNSBruteService)) private dnsBruteService: DNSBruteService,
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

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledAbuseIPDBWatch() {
    await this.runJobIfEnabled('watch_abuseipdb', (log) => this.runAbuseIPDBWatch(log));
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledCTMonitor() {
    await this.runJobIfEnabled('watch_ct_logs', (log) => this.runCTMonitor(log));
  }

  @Cron('0 */8 * * *') // Every 8 hours
  async scheduledWaybackWatch() {
    await this.runJobIfEnabled('watch_wayback', (log) => this.runWaybackWatch(log));
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM) // Daily at 1 AM
  async scheduledDNSBruteWatch() {
    await this.runJobIfEnabled('watch_dns_brute', (log) => this.runDNSBruteWatch(log));
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
      watch_ns_all: (log) => this.runDnsAll(log),
      watch_live_all: (log) => this.runLiveAll(log),
      watch_http_all: (log) => this.runHttpAll(log),
      watch_nuclei_all: (log) => this.runNucleiAll(log),
      fresh_detection: (log) => this.runFreshDetection(log),
      score_calculation: (log) => this.runScoreCalculation(log),
      watch_abuseipdb: (log) => this.runAbuseIPDBWatch(log),
      watch_ct_logs: (log) => this.runCTMonitor(log),
      watch_wayback: (log) => this.runWaybackWatch(log),
      watch_dns_brute: (log) => this.runDNSBruteWatch(log),
    };

    const handler = handlers[jobName];
    if (!handler) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    return this.executeJob(jobName, handler, 'manual');
  }

  async getExecutions(
    jobName?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: JobExecutionDocument[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const query = jobName ? { jobName } : {};
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.jobExecutionModel
        .find(query)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.jobExecutionModel.countDocuments(query).exec(),
    ]);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  /**
   * Get subfinder queue statistics from RabbitMQ
   */
  async getSubfinderQueueStats(): Promise<{
    messages: number;
    consumers: number;
    messagesReady: number;
    messagesUnacked: number;
  }> {
    try {
      const response = await fetch(
        'http://rabbitmq:15672/api/queues/watchtower/watchtower.subfinder',
        {
          headers: {
            Authorization: 'Basic ' + Buffer.from('bugbounty:bugbounty2024').toString('base64'),
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`RabbitMQ API error: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        messages: data.messages || 0,
        consumers: data.consumers || 0,
        messagesReady: data.messages_ready || 0,
        messagesUnacked: data.messages_unacknowledged || 0,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      return {
        messages: 0,
        consumers: 0,
        messagesReady: 0,
        messagesUnacked: 0,
      };
    }
  }

  /**
   * Clear the subfinder queue (purge all pending messages)
   */
  async clearSubfinderQueue(): Promise<{ success: boolean; messagesCleared: number; message: string }> {
    try {
      // First get current message count
      const stats = await this.getSubfinderQueueStats();
      const messageCount = stats.messages;

      // Purge the queue via RabbitMQ API
      const response = await fetch(
        'http://rabbitmq:15672/api/queues/watchtower/watchtower.subfinder/contents',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Basic ' + Buffer.from('bugbounty:bugbounty2024').toString('base64'),
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`RabbitMQ API error: ${response.status}`);
      }
      
      this.logger.log(`Cleared subfinder queue: ${messageCount} messages purged`);
      
      return {
        success: true,
        messagesCleared: messageCount,
        message: `Cleared ${messageCount} pending jobs from subfinder queue`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to clear queue: ${error.message}`);
      return {
        success: false,
        messagesCleared: 0,
        message: `Failed to clear queue: ${error.message}`,
      };
    }
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
    const allDomains = domainsResult.data;
    await log(`Found ${allDomains.length} total domain entries`);
    
    if (allDomains.length === 0) {
      await log('No domains found. Add domains first.');
      return { message: 'No domains to scan', scanned: 0 };
    }

    // Filter to only scan root domains and wildcards (not subdomains)
    // Root domain pattern: domain.tld or *.domain.tld
    const rootDomainPattern = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    
    const domainsToScan = allDomains.filter(d => {
      const domain = d.domain;
      // Skip if it's clearly a subdomain (has more than 2 dots and doesn't start with *)
      const dotCount = (domain.match(/\./g) || []).length;
      
      // Handle wildcards - extract the base domain
      if (domain.startsWith('*.')) {
        return true; // Wildcards are good to scan
      }
      
      // Skip subdomains like mail.notion.so, staging.hosted.mender.io
      // Keep root domains like stripchat.com, notion.so
      if (dotCount > 1) {
        // Check if it's a known TLD pattern (co.uk, com.au, etc.)
        const knownMultiPartTlds = ['.co.uk', '.com.au', '.co.nz', '.co.jp', '.com.br', '.co.in'];
        const hasMultiPartTld = knownMultiPartTlds.some(tld => domain.endsWith(tld));
        if (hasMultiPartTld && dotCount === 2) {
          return true; // e.g., example.co.uk
        }
        return false; // Skip subdomains
      }
      
      return true; // Root domains with 1 dot
    });

    await log(`Filtered to ${domainsToScan.length} root domains (skipped ${allDomains.length - domainsToScan.length} subdomains)`);

    if (domainsToScan.length === 0) {
      await log('No root domains found to scan.');
      return { message: 'No root domains to scan', scanned: 0 };
    }

    // Generate batch ID for tracking
    const batchId = `subfinder-${Date.now()}`;
    await log(`Batch ID: ${batchId}`);
    
    // Publish domains to the queue for parallel processing
    // For wildcards, remove the *. prefix
    const domainJobs = domainsToScan.map(d => ({
      domain: d.domain.startsWith('*.') ? d.domain.substring(2) : d.domain,
      domainId: d._id.toString(),
    }));
    
    const published = await this.queueService.publishSubfinderBatch(domainJobs, batchId);
    
    await log(`✓ Published ${published} domains to subfinder queue`);
    await log(`Workers will process domains in parallel`);
    await log(`Monitor progress in RabbitMQ: http://localhost:15672`);

    return {
      message: 'Subfinder jobs queued for parallel processing',
      batchId,
      domainsTotal: allDomains.length,
      rootDomainsFiltered: domainsToScan.length,
      domainsQueued: published,
      note: 'Jobs are being processed by workers in parallel. Check RabbitMQ for progress.',
    };
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
    const newlyAlive: string[] = []; // Track subdomains that became alive
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
          const wasAlive = sub.isAlive;
          try {
            const addresses = await dns.resolve(sub.subdomain);
            await this.subdomainsService.update(sub._id.toString(), {
              isAlive: true,
              ip: addresses,
            });
            // Track if this subdomain just became alive
            if (!wasAlive) {
              return { alive: true, newlyAlive: true, subdomain: sub.subdomain };
            }
            return { alive: true, newlyAlive: false };
          } catch {
            await this.subdomainsService.update(sub._id.toString(), { isAlive: false });
            return { alive: false, newlyAlive: false };
          }
        })
      );
      
      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.alive) {
            alive++;
            if (result.value.newlyAlive && result.value.subdomain) {
              newlyAlive.push(result.value.subdomain);
            }
          } else {
            dead++;
          }
        } else {
          dead++;
        }
      }
    }

    await log(`DNS resolution complete: ${alive} alive, ${dead} dead`);
    
    // Send notification for newly alive subdomains
    if (newlyAlive.length > 0) {
      await log(`🆕 ${newlyAlive.length} subdomains became alive!`);
      try {
        await this.queueService.publishNotification({
          type: 'new_live',
          data: {
            count: newlyAlive.length,
            subdomains: newlyAlive.slice(0, 50), // Limit to first 50 for notification
            timestamp: new Date(),
            source: 'dns_resolution',
          },
          channels: ['discord', 'telegram'],
        });
        await log('Notification sent for newly alive subdomains');
      } catch (e: any) {
        await log(`Failed to send notification: ${e.message}`);
      }
    }

    return { 
      message: 'DNS resolution completed', 
      alive, 
      dead, 
      total: subdomains.length,
      newlyAlive: newlyAlive.length,
    };
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

    const result = await this.cliService.watchHttpAll();

    if (result.success) {
      const results = result.results as
        | { hostsChecked?: number; subdomainsUpdated?: number }
        | undefined;
      await log(
        `Found ${results?.hostsChecked || 0} alive subdomains to probe`,
      );
      await log(
        `HTTP probing complete: ${results?.subdomainsUpdated || 0} subdomains updated`,
      );
    } else {
      await log(result.message);
    }

    return result;
  }

  private extractTitle(html: string): string | undefined {
    const match = html?.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim().substring(0, 200) : undefined;
  }

  private async runNucleiAll(log: LogFn): Promise<any> {
    await log('Starting Nuclei vulnerability scanning...');
    
    const subdomainsResult = await this.subdomainsService.findAll({ isAlive: true, limit: 1000 });
    const subdomains = subdomainsResult.data;
    await log(`Found ${subdomains.length} alive subdomains for scanning`);
    
    if (subdomains.length === 0) {
      await log('No alive subdomains found. Run DNS resolution first.');
      return { message: 'No targets to scan', scanned: 0 };
    }

    // Build target URLs (prefer HTTP URLs if available, otherwise use subdomain)
    const targets = subdomains.map(sub => {
      if (sub.httpStatus && sub.httpStatus >= 200 && sub.httpStatus < 400) {
        return `https://${sub.subdomain}`;
      }
      return `http://${sub.subdomain}`;
    });

    await log(`Scanning ${targets.length} targets with Nuclei...`);

    try {
      // Run nuclei scan using the NucleiService
      const results = await this.nucleiService.scan(targets);
      
      await log(`Nuclei scan complete: ${results.length} findings`);

      // Group findings by severity
      const bySeverity = {
        critical: results.filter(r => r.severity === 'critical').length,
        high: results.filter(r => r.severity === 'high').length,
        medium: results.filter(r => r.severity === 'medium').length,
        low: results.filter(r => r.severity === 'low').length,
        info: results.filter(r => r.severity === 'info').length,
      };

      await log(`Findings by severity: Critical=${bySeverity.critical}, High=${bySeverity.high}, Medium=${bySeverity.medium}, Low=${bySeverity.low}, Info=${bySeverity.info}`);

      // Send notification for critical/high findings
      const criticalHighFindings = results.filter(r => r.severity === 'critical' || r.severity === 'high');
      if (criticalHighFindings.length > 0) {
        await log(`⚠️ ${criticalHighFindings.length} critical/high severity findings!`);
        try {
          await this.queueService.publishNotification({
            type: 'vulnerability',
            data: {
              count: criticalHighFindings.length,
              findings: criticalHighFindings.slice(0, 10).map(f => ({
                template: f.templateName,
                severity: f.severity,
                host: f.host,
                matched: f.matchedAt,
              })),
              timestamp: new Date(),
              source: 'nuclei_scan',
            },
            channels: ['discord', 'telegram'],
          });
          await log('Notification sent for critical/high findings');
        } catch (e: any) {
          await log(`Failed to send notification: ${e.message}`);
        }
      }

      return {
        message: 'Nuclei scan completed',
        targets: targets.length,
        findings: results.length,
        bySeverity,
        criticalHigh: criticalHighFindings.length,
      };
    } catch (error: any) {
      await log(`Nuclei scan error: ${error.message}`);
      
      // Check if it's a Docker/nuclei availability issue
      if (error.message.includes('docker') || error.message.includes('nuclei')) {
        await log('Note: Ensure the nuclei container is running (bb-nuclei)');
      }
      
      throw error;
    }
  }

  private async runFreshDetection(log: LogFn): Promise<any> {
    await log('Starting fresh detection...');
    await log('Marking stale live hosts (older than 24h)...');
    
    const livesMarked = await this.livesService.markAsNotFresh(24);

    await log(`Marked ${livesMarked} live hosts as not fresh`);

    return {
      livesMarked,
    };
  }

  private async runScoreCalculation(log: LogFn): Promise<any> {
    await log('Starting score calculation for all assets...');
    const result = await this.scoresService.calculateAllScores();
    await log(`Score calculation completed`);
    return result;
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

          // Update subdomain with abuse score
          if (subdomain) {
            await this.subdomainsService.update(subdomain._id.toString(), {
              abuseScore: result.abuseConfidenceScore,
            });
          }

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

  /**
   * Waybackurls endpoint discovery
   * Fetches historical URLs from Wayback Machine for alive subdomains
   * Stores discovered endpoints and updates subdomain endpointCount
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  private async runWaybackWatch(log: LogFn): Promise<any> {
    await log('Starting Waybackurls endpoint discovery...');

    try {
      // Get alive subdomains to scan
      const subdomainsResult = await this.subdomainsService.findAll({
        isAlive: true,
        limit: 100,
      });
      const subdomains = subdomainsResult.data;
      await log(`Found ${subdomains.length} alive subdomains to scan`);

      if (subdomains.length === 0) {
        await log('No alive subdomains found. Run DNS resolution first.');
        return { message: 'No subdomains to scan', scanned: 0 };
      }

      let totalEndpoints = 0;
      let totalNew = 0;
      const maxSubdomains = 20; // Limit to avoid long execution

      for (const sub of subdomains.slice(0, maxSubdomains)) {
        try {
          await log(`Fetching wayback URLs for: ${sub.subdomain}`);

          const result = await this.waybackService.fetchUrls(sub.subdomain);
          await log(`Found ${result.urls.length} URLs, ${result.extractedEndpoints.length} unique endpoints`);

          if (result.extractedEndpoints.length > 0) {
            // Store endpoints
            const endpointsToCreate = result.extractedEndpoints.map(ep => ({
              url: ep.url,
              subdomainId: sub._id.toString(),
              data: {
                path: ep.path,
                method: ep.method,
                parameters: ep.parameters,
                hasParams: ep.hasParams,
                sources: ['waybackurls'],
              },
            }));

            const { created, updated } = await this.endpointsService.bulkCreate(endpointsToCreate as any);
            totalEndpoints += result.extractedEndpoints.length;
            totalNew += created;

            await log(`Stored ${created} new, ${updated} updated endpoints for ${sub.subdomain}`);

            // Update subdomain endpointCount
            await this.subdomainsService.update(sub._id.toString(), {
              endpointCount: result.extractedEndpoints.length,
            });
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          await log(`Error scanning ${sub.subdomain}: ${error.message}`);
        }
      }

      await log(`Wayback scan complete: ${totalEndpoints} endpoints found, ${totalNew} new`);

      return {
        message: 'Wayback scan completed',
        subdomainsScanned: Math.min(subdomains.length, maxSubdomains),
        totalEndpoints,
        newEndpoints: totalNew,
      };
    } catch (error: any) {
      await log(`Wayback watch error: ${error.message}`);
      throw error;
    }
  }

  /**
   * DNS brute forcing for watched domains
   * Periodically runs DNS brute forcing for domains with watching enabled
   * Stores new discoveries with appropriate source (dns_brute or dns_gen)
   * Requirements: 11.5, 12.5
   */
  private async runDNSBruteWatch(log: LogFn): Promise<any> {
    await log('Starting DNS brute forcing for watched domains...');

    try {
      // Get domains to brute force (limit to avoid long execution)
      const domainsResult = await this.domainsService.findAll({ limit: 10 });
      const domains = domainsResult.data;
      await log(`Found ${domains.length} domains for DNS brute forcing`);

      if (domains.length === 0) {
        await log('No domains found. Add domains first.');
        return { message: 'No domains to brute force', discovered: 0 };
      }

      let totalDiscovered = 0;
      let totalNew = 0;
      const results: { domain: string; discovered: number; new: number }[] = [];

      // Default wordlist config for static brute forcing
      const defaultWordlistConfig = {
        sources: {
          bestDns: true,
          twoMillionSubdomains: false, // Skip large wordlist for cron job
          crunch: true,
          custom: [],
        },
        crunchConfig: {
          minLength: 1,
          maxLength: 3, // Shorter for cron job
          charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
        },
      };

      for (const domain of domains) {
        try {
          // Skip wildcard domains
          if (domain.domain.startsWith('*.')) {
            await log(`Skipping wildcard domain: ${domain.domain}`);
            continue;
          }

          await log(`Running DNS brute for: ${domain.domain}`);

          // Get existing subdomains for this domain
          const existingSubdomainsResult = await this.subdomainsService.findAll({
            domainId: domain._id.toString(),
            limit: 10000,
          });
          const existingSubdomains = existingSubdomainsResult.data.map(s => s.subdomain);
          const existingSet = new Set(existingSubdomains.map(s => s.toLowerCase()));

          await log(`Found ${existingSubdomains.length} existing subdomains for ${domain.domain}`);

          // Run static DNS brute forcing
          const config = {
            domain: domain.domain,
            wordlistConfig: defaultWordlistConfig,
            threads: 100, // Reduced for cron job
            mode: 'static' as const,
          };

          const discoveredSubdomains: string[] = [];
          const newSubdomains: string[] = [];

          try {
            for await (const subdomain of this.dnsBruteService.runStaticBrute(config)) {
              discoveredSubdomains.push(subdomain);
              
              if (!existingSet.has(subdomain.toLowerCase())) {
                newSubdomains.push(subdomain);
                existingSet.add(subdomain.toLowerCase());

                // Store new subdomain with dns_brute source
                try {
                  await this.subdomainsService.create({
                    subdomain: subdomain,
                    domainId: domain._id.toString(),
                    sources: ['dns_brute'],
                    isAlive: true, // Resolved by shuffledns
                  });
                } catch (e: any) {
                  // Ignore duplicates
                  if (!e.message?.includes('duplicate')) {
                    this.logger.warn(`Failed to save DNS brute subdomain ${subdomain}: ${e.message}`);
                  }
                }
              }
            }
          } catch (bruteError: any) {
            await log(`DNS brute error for ${domain.domain}: ${bruteError.message}`);
          }

          await log(`DNS brute for ${domain.domain}: ${discoveredSubdomains.length} discovered, ${newSubdomains.length} new`);

          totalDiscovered += discoveredSubdomains.length;
          totalNew += newSubdomains.length;
          results.push({
            domain: domain.domain,
            discovered: discoveredSubdomains.length,
            new: newSubdomains.length,
          });

          // Send notification for new discoveries
          if (newSubdomains.length > 0) {
            await log(`🆕 ${newSubdomains.length} new subdomains discovered for ${domain.domain}`);

            try {
              await this.queueService.publishNotification({
                type: 'new_subdomain',
                data: {
                  domain: domain.domain,
                  source: 'dns_brute',
                  count: newSubdomains.length,
                  subdomains: newSubdomains.slice(0, 20),
                  timestamp: new Date(),
                },
                channels: ['discord', 'telegram'],
              });
              await log('Notification sent for new DNS brute discoveries');
            } catch (notifyError: any) {
              await log(`Failed to send DNS brute notification: ${notifyError.message}`);
            }
          }

          // Rate limiting between domains
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error: any) {
          await log(`Error brute forcing ${domain.domain}: ${error.message}`);
        }
      }

      await log(`DNS brute watch complete: ${totalDiscovered} discovered, ${totalNew} new`);

      return {
        message: 'DNS brute watch completed',
        domainsProcessed: domains.length,
        totalDiscovered,
        newSubdomains: totalNew,
        results,
      };
    } catch (error: any) {
      await log(`DNS brute watch error: ${error.message}`);
      throw error;
    }
  }
}
