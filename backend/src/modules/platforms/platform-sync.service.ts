import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Scope, ScopeDocument, ScopeType, ScopeStatus } from '../../schemas/scope.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { HackerOneService, HackerOneProgram } from './services/hackerone.service';
import { BugcrowdService, BugcrowdProgram } from './services/bugcrowd.service';
import { ChaosService, ChaosProgram } from './services/chaos.service';
import { BountyTargetsService, BountyTargetsProgram, BountyTargetsScope } from './services/bounty-targets.service';
import { QueueService } from '../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

export interface SyncResult {
  platform: string;
  newPrograms: number;
  updatedPrograms: number;
  newScopes: number;
  errors: string[];
  duration: number;
  successCount?: number;
  failureCount?: number;
}

export type LogFn = (message: string) => Promise<void>;

/**
 * Configuration for concurrent processing
 */
export interface ConcurrencyConfig {
  /** Number of programs to process concurrently (default: 10) */
  concurrency: number;
  /** Use queue-based workers instead of in-process concurrency */
  useWorkers: boolean;
  /** Batch size for bulk operations (default: 100) */
  batchSize: number;
}

/**
 * Rate limit error class for identifying 429 responses
 */
export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Configuration for exponential backoff retry
 * Requirements: 6.1 - Implement retry logic for 429 responses
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,  // 1s, 2s, 4s, 8s
  maxDelayMs: 8000,
};

@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  constructor(
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Scope.name) private scopeModel: Model<ScopeDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    private hackerOneService: HackerOneService,
    private bugcrowdService: BugcrowdService,
    private chaosService: ChaosService,
    private bountyTargetsService: BountyTargetsService,
    private queueService: QueueService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Sleep utility for delays
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   * Requirements: 6.1 - Use delays: 1s, 2s, 4s, 8s with max 3 retries
   * 
   * @param attempt Current attempt number (0-indexed)
   * @param config Retry configuration
   * @returns Delay in milliseconds
   */
  calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
    // Exponential backoff: baseDelay * 2^attempt
    const delay = config.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelayMs);
  }

  /**
   * Execute an async operation with exponential backoff retry on rate limit errors
   * Requirements: 6.1 - Implement retry logic for 429 responses
   * 
   * @param operation The async operation to execute
   * @param operationName Name for logging purposes
   * @param config Retry configuration
   * @returns Result of the operation
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a rate limit error (429)
        const isRateLimitError = 
          error instanceof RateLimitError ||
          error.response?.status === 429 ||
          error.status === 429 ||
          error.message?.includes('429') ||
          error.message?.toLowerCase().includes('rate limit');

        if (!isRateLimitError) {
          // Not a rate limit error, don't retry
          throw error;
        }

        if (attempt < config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, config);
          this.logger.warn(
            `Rate limit hit for ${operationName}, attempt ${attempt + 1}/${config.maxRetries + 1}. ` +
            `Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.logger.error(`All ${config.maxRetries + 1} attempts failed for ${operationName}`);
    throw lastError;
  }

  // Run every 6 hours
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync() {
    this.logger.log('Starting scheduled platform sync');
    await this.syncAllPlatforms();
  }

  /**
   * Sync all platforms including new data sources
   * 
   * Requirements: 4.3 - Include Chaos and bounty-targets-data in syncAllPlatforms
   * Requirements: 4.4 - Execute syncs sequentially to avoid rate limiting
   * Requirements: 4.5 - Return SyncResult for each data source
   * 
   * Order of execution:
   * 1. HackerOne (direct API)
   * 2. Bugcrowd (direct API)
   * 3. Chaos (after direct APIs)
   * 4. Bounty-targets (last, for deduplication)
   * 
   * @param log Optional logging function
   * @returns Array of SyncResult objects for each platform
   */
  async syncAllPlatforms(log?: LogFn): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const logMsg = log || (async (msg: string) => this.logger.log(msg));

    // Sync HackerOne (direct API first)
    // Requirements: 8.3 - Log start and completion of each source
    // Requirements: 8.4 - Continue with remaining sources if one fails
    try {
      await logMsg('Starting HackerOne sync...');
      const h1Result = await this.syncHackerOne(logMsg);
      results.push(h1Result);
      await logMsg(`HackerOne sync completed: ${h1Result.newPrograms} new, ${h1Result.updatedPrograms} updated, ${h1Result.newScopes} scopes`);
    } catch (error: any) {
      await logMsg(`ERROR: HackerOne sync failed: ${error.message}`);
      this.logger.error(`HackerOne sync failed: ${error.message}`);
      // Continue with remaining sources - Requirement 8.4
    }

    // Sync Bugcrowd (direct API)
    try {
      await logMsg('Starting Bugcrowd sync...');
      const bcResult = await this.syncBugcrowd(logMsg);
      results.push(bcResult);
      await logMsg(`Bugcrowd sync completed: ${bcResult.newPrograms} new, ${bcResult.updatedPrograms} updated, ${bcResult.newScopes} scopes`);
    } catch (error: any) {
      await logMsg(`ERROR: Bugcrowd sync failed: ${error.message}`);
      this.logger.error(`Bugcrowd sync failed: ${error.message}`);
      // Continue with remaining sources - Requirement 8.4
    }

    // Sync Chaos (after direct APIs)
    // Requirements: 4.3, 8.1 - Include Chaos in scheduled sync (every 6 hours)
    try {
      await logMsg('Starting Chaos sync...');
      const chaosResult = await this.syncChaos(logMsg);
      results.push(chaosResult);
      await logMsg(`Chaos sync completed: ${chaosResult.newPrograms} new, ${chaosResult.updatedPrograms} updated`);
    } catch (error: any) {
      await logMsg(`ERROR: Chaos sync failed: ${error.message}`);
      this.logger.error(`Chaos sync failed: ${error.message}`);
      // Continue with remaining sources - Requirement 8.4
    }

    // Sync bounty-targets (last for deduplication) - Using optimized concurrent sync
    // Requirements: 4.3, 7.2, 8.2 - Include bounty-targets in scheduled sync (every 6 hours)
    try {
      await logMsg('Starting bounty-targets sync (optimized with concurrency)...');
      const btResult = await this.syncBountyTargetsOptimized(logMsg, {
        concurrency: 15,  // Process 15 programs concurrently
        useWorkers: false, // Use in-process concurrency for scheduled sync
        batchSize: 100,
      });
      results.push(btResult);
      await logMsg(`Bounty-targets sync completed: ${btResult.newPrograms} new, ${btResult.updatedPrograms} updated, ${btResult.newScopes} scopes`);
    } catch (error: any) {
      await logMsg(`ERROR: bounty-targets sync failed: ${error.message}`);
      this.logger.error(`bounty-targets sync failed: ${error.message}`);
      // Continue - this is the last source
    }

    // Send notification about sync results (only if we have results)
    if (results.length > 0) {
      try {
        await this.notifySync(results);
      } catch (error: any) {
        await logMsg(`ERROR: Failed to send sync notification: ${error.message}`);
      }
    }
    
    // Aggregate results from all sources - Requirements: 4.5
    const totalNew = results.reduce((acc, r) => acc + r.newPrograms, 0);
    const totalUpdated = results.reduce((acc, r) => acc + r.updatedPrograms, 0);
    const totalScopes = results.reduce((acc, r) => acc + r.newScopes, 0);
    await logMsg(`Total: ${totalNew} new programs, ${totalUpdated} updated, ${totalScopes} new scopes`);

    return results;
  }

  async syncHackerOne(log?: LogFn): Promise<SyncResult> {
    const startTime = Date.now();
    const logMsg = log || (async (msg: string) => this.logger.log(msg));
    const result: SyncResult = {
      platform: 'hackerone',
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      errors: [],
      duration: 0,
      successCount: 0,
      failureCount: 0,
    };

    try {
      await logMsg('Fetching HackerOne public programs...');
      
      // Use retry with exponential backoff for fetching programs (Requirement 6.1)
      const programs = await this.withRetry(
        () => this.hackerOneService.getPublicPrograms(),
        'HackerOne getPublicPrograms',
      );
      await logMsg(`Found ${programs.length} HackerOne programs`);

      // Process each program with error isolation (Requirement 6.2)
      for (const program of programs) {
        try {
          const { isNew, programId } = await this.upsertProgram(program, 'hackerone');
          
          if (isNew) {
            result.newPrograms++;
            await logMsg(`NEW: ${program.name} (${program.handle})`);
            await this.notifyNewProgram(program.name, 'hackerone');
          } else {
            result.updatedPrograms++;
          }

          // Sync scopes
          const scopeCount = await this.syncHackerOneScopes(programId, program);
          if (scopeCount > 0) {
            await logMsg(`  - ${scopeCount} new scopes for ${program.handle}`);
          }
          result.newScopes += scopeCount;
          
          // Track success (Requirement 6.2)
          result.successCount!++;
        } catch (error: any) {
          // Error isolation: catch errors per program, log and continue (Requirement 6.2)
          result.errors.push(`${program.handle}: ${error.message}`);
          result.failureCount!++;
          await logMsg(`ERROR: ${program.handle}: ${error.message}`);
          // Continue with remaining programs - don't rethrow
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: HackerOne sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    // Log sync summary (Requirement 6.4)
    await logMsg(
      `HackerOne sync completed in ${result.duration}ms - ` +
      `Success: ${result.successCount}, Failures: ${result.failureCount}, ` +
      `New: ${result.newPrograms}, Updated: ${result.updatedPrograms}, Scopes: ${result.newScopes}`
    );
    
    return result;
  }

  async syncBugcrowd(log?: LogFn): Promise<SyncResult> {
    const startTime = Date.now();
    const logMsg = log || (async (msg: string) => this.logger.log(msg));
    const result: SyncResult = {
      platform: 'bugcrowd',
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      errors: [],
      duration: 0,
      successCount: 0,
      failureCount: 0,
    };

    try {
      await logMsg('Fetching Bugcrowd public programs...');
      
      // Use retry with exponential backoff for fetching programs (Requirement 6.1)
      const programs = await this.withRetry(
        () => this.bugcrowdService.fetchPublicPrograms(),
        'Bugcrowd fetchPublicPrograms',
      );
      await logMsg(`Found ${programs.length} Bugcrowd programs`);

      // Process each program with error isolation (Requirement 6.2)
      for (const program of programs) {
        try {
          const { isNew, programId } = await this.upsertBugcrowdProgram(program);
          
          if (isNew) {
            result.newPrograms++;
            await logMsg(`NEW: ${program.name} (${program.code})`);
            await this.notifyNewProgram(program.name, 'bugcrowd');
          } else {
            result.updatedPrograms++;
          }

          // Sync scopes
          const scopeCount = await this.syncBugcrowdScopes(programId, program);
          if (scopeCount > 0) {
            await logMsg(`  - ${scopeCount} new scopes for ${program.code}`);
          }
          result.newScopes += scopeCount;
          
          // Track success (Requirement 6.2)
          result.successCount!++;
        } catch (error: any) {
          // Error isolation: catch errors per program, log and continue (Requirement 6.2)
          result.errors.push(`${program.code}: ${error.message}`);
          result.failureCount!++;
          await logMsg(`ERROR: ${program.code}: ${error.message}`);
          // Continue with remaining programs - don't rethrow
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: Bugcrowd sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    // Log sync summary (Requirement 6.4)
    await logMsg(
      `Bugcrowd sync completed in ${result.duration}ms - ` +
      `Success: ${result.successCount}, Failures: ${result.failureCount}, ` +
      `New: ${result.newPrograms}, Updated: ${result.updatedPrograms}, Scopes: ${result.newScopes}`
    );
    
    return result;
  }

  /**
   * Sync programs from ProjectDiscovery Chaos API
   * 
   * Requirements: 1.6 - Create new programs or update existing programs with matching handles
   * Requirements: 4.1 - Provide method to sync only Chaos data
   * Requirements: 6.1 - Use retry with exponential backoff for rate limit handling
   * Requirements: 6.2 - Process each program with error isolation
   * 
   * @param log Optional logging function
   * @returns SyncResult with statistics
   */
  async syncChaos(log?: LogFn): Promise<SyncResult> {
    const startTime = Date.now();
    const logMsg = log || (async (msg: string) => this.logger.log(msg));
    const result: SyncResult = {
      platform: 'chaos',
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      errors: [],
      duration: 0,
      successCount: 0,
      failureCount: 0,
    };

    try {
      await logMsg('Fetching Chaos programs...');
      
      // Use retry with exponential backoff for fetching programs (Requirement 6.1)
      const programs = await this.withRetry(
        () => this.chaosService.getPrograms(),
        'Chaos getPrograms',
      );
      await logMsg(`Found ${programs.length} Chaos programs`);

      // Process each program with error isolation (Requirement 6.2)
      for (const program of programs) {
        try {
          const { isNew, programId } = await this.upsertChaosProgram(program);
          
          if (isNew) {
            result.newPrograms++;
            await logMsg(`NEW: ${program.name} (${program.handle})`);
            await this.notifyNewProgram(program.name, 'chaos');
          } else {
            result.updatedPrograms++;
          }
          
          // Track success (Requirement 6.2)
          result.successCount!++;
        } catch (error: any) {
          // Error isolation: catch errors per program, log and continue (Requirement 6.2)
          result.errors.push(`${program.handle}: ${error.message}`);
          result.failureCount!++;
          await logMsg(`ERROR: ${program.handle}: ${error.message}`);
          // Continue with remaining programs - don't rethrow
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: Chaos sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    // Log sync summary (Requirement 6.4)
    await logMsg(
      `Chaos sync completed in ${result.duration}ms - ` +
      `Success: ${result.successCount}, Failures: ${result.failureCount}, ` +
      `New: ${result.newPrograms}, Updated: ${result.updatedPrograms}`
    );
    
    return result;
  }

  /**
   * Upsert a Chaos program into the database
   * 
   * Requirements: 1.6 - Create new programs or update existing programs with matching handles
   * Requirements: 7.1 - Use platform + handle as unique identifier
   * Requirements: 7.4 - Preserve firstSyncedAt timestamp when updating
   * 
   * @param program The ChaosProgram to upsert
   * @returns Object with isNew flag and programId
   */
  private async upsertChaosProgram(
    program: ChaosProgram,
  ): Promise<{ isNew: boolean; programId: Types.ObjectId }> {
    // Use the original platform from Chaos data if it's a valid platform
    // Otherwise fall back to 'other' for unknown platforms
    const validPlatforms = ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'yeswehack', 'federacy', 'github'];
    const platform = validPlatforms.includes(program.platform?.toLowerCase()) 
      ? program.platform.toLowerCase() 
      : 'other';
    
    const existing = await this.programModel.findOne({
      platform,
      handle: program.handle,
    });

    // Build enriched data object
    const enrichedData: Record<string, any> = {
      name: program.name,
      url: program.url,
      offersBounties: program.bounty,
      subdomainCount: program.subdomainCount,
      lastSyncedAt: new Date(),
    };

    // Store the source as Chaos in platformUrl for reference
    enrichedData.platformUrl = program.url;

    // Data source identifier for Chaos (ProjectDiscovery)
    const dataSource = 'chaos';

    if (existing) {
      // Update existing program, preserving firstSyncedAt (Requirement 7.4)
      // Add data source to existing record if not already present
      await this.programModel.updateOne(
        { _id: existing._id },
        { 
          $set: enrichedData,
          $addToSet: { dataSources: dataSource },
        },
      );
      return { isNew: false, programId: existing._id };
    }

    // Create new program
    const newProgram = await this.programModel.create({
      platform,
      handle: program.handle,
      ...enrichedData,
      isActive: true,
      scope: [],
      outOfScope: [],
      dataSources: [dataSource],
      firstSyncedAt: new Date(),
    });

    return { isNew: true, programId: newProgram._id };
  }

  /**
   * Sync programs from bounty-targets-data GitHub repository
   * 
   * Requirements: 4.2 - Provide method to sync only bounty-targets-data
   * Requirements: 7.1 - Use platform + handle as unique identifier for deduplication
   * Requirements: 7.2 - Skip programs already synced from direct APIs (deduplication)
   * Requirements: 7.3 - Use platform + handle as unique identifier
   * Requirements: 7.4 - Preserve firstSyncedAt timestamp when updating
   * 
   * @param log Optional logging function
   * @returns SyncResult with statistics
   */
  async syncBountyTargets(log?: LogFn): Promise<SyncResult> {
    const startTime = Date.now();
    const logMsg = log || (async (msg: string) => this.logger.log(msg));
    const result: SyncResult = {
      platform: 'bounty-targets',
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      errors: [],
      duration: 0,
      successCount: 0,
      failureCount: 0,
    };

    try {
      await logMsg('Fetching bounty-targets-data programs...');
      
      // Use retry with exponential backoff for fetching programs (Requirement 6.1)
      const programs = await this.withRetry(
        () => this.bountyTargetsService.getAllPrograms(),
        'BountyTargets getAllPrograms',
      );
      await logMsg(`Found ${programs.length} bounty-targets programs`);

      // Process each program with error isolation (Requirement 6.2)
      for (const program of programs) {
        try {
          // Check if program already exists from direct API sync (Requirement 7.2)
          const existingFromDirectApi = await this.programModel.findOne({
            platform: program.platform,
            handle: program.handle,
          });

          if (existingFromDirectApi) {
            // Program already synced from another source
            // Merge data from bounty-targets: add data source, update fields if missing, sync scopes
            const updateFields: Record<string, any> = {
              lastSyncedAt: new Date(),
            };
            
            // Merge bounty range if not already set
            if (program.maxBounty != null && !existingFromDirectApi.bountyRange?.max) {
              updateFields.bountyRange = { max: program.maxBounty };
            }
            
            // Merge offersBounties if bounty-targets says it offers bounties
            if (program.offersBounties && !existingFromDirectApi.offersBounties) {
              updateFields.offersBounties = true;
            }
            
            await this.programModel.updateOne(
              { _id: existingFromDirectApi._id },
              { 
                $addToSet: { dataSources: 'bounty-targets' },
                $set: updateFields,
              },
            );
            
            // Sync scopes from bounty-targets even for existing programs
            const scopeCount = await this.syncBountyTargetsScopes(existingFromDirectApi._id, program);
            if (scopeCount > 0) {
              await logMsg(`  - ${scopeCount} new scopes for ${program.handle} (merged)`);
            }
            result.newScopes += scopeCount;
            
            result.updatedPrograms++;
            result.successCount!++;
            continue;
          }

          const { isNew, programId } = await this.upsertBountyTargetsProgram(program);
          
          if (isNew) {
            result.newPrograms++;
            await logMsg(`NEW: ${program.name} (${program.handle}) [${program.platform}]`);
            await this.notifyNewProgram(program.name, program.platform);
          } else {
            result.updatedPrograms++;
          }

          // Sync scopes for this program
          const scopeCount = await this.syncBountyTargetsScopes(programId, program);
          if (scopeCount > 0) {
            await logMsg(`  - ${scopeCount} new scopes for ${program.handle}`);
          }
          result.newScopes += scopeCount;
          
          // Track success (Requirement 6.2)
          result.successCount!++;
        } catch (error: any) {
          // Error isolation: catch errors per program, log and continue (Requirement 6.2)
          result.errors.push(`${program.handle}: ${error.message}`);
          result.failureCount!++;
          await logMsg(`ERROR: ${program.handle}: ${error.message}`);
          // Continue with remaining programs - don't rethrow
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: bounty-targets sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    // Log sync summary (Requirement 6.4)
    await logMsg(
      `bounty-targets sync completed in ${result.duration}ms - ` +
      `Success: ${result.successCount}, Failures: ${result.failureCount}, ` +
      `New: ${result.newPrograms}, Updated: ${result.updatedPrograms}, Scopes: ${result.newScopes}`
    );
    
    return result;
  }

  /**
   * Optimized sync for bounty-targets using concurrent processing
   * 
   * This method processes programs in parallel batches for significantly faster sync times.
   * For very large datasets, use useWorkers=true to distribute work across multiple worker processes.
   * 
   * @param log Optional logging function
   * @param config Concurrency configuration
   * @returns SyncResult with statistics
   */
  async syncBountyTargetsOptimized(
    log?: LogFn,
    config: Partial<ConcurrencyConfig> = {},
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const logMsg = log || (async (msg: string) => this.logger.log(msg));
    const { concurrency = 10, useWorkers = false, batchSize = 100 } = config;
    
    const result: SyncResult = {
      platform: 'bounty-targets',
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      errors: [],
      duration: 0,
      successCount: 0,
      failureCount: 0,
    };

    try {
      await logMsg(`Fetching bounty-targets-data programs (concurrency: ${concurrency}, workers: ${useWorkers})...`);
      
      const programs = await this.withRetry(
        () => this.bountyTargetsService.getAllPrograms(),
        'BountyTargets getAllPrograms',
      );
      await logMsg(`Found ${programs.length} bounty-targets programs`);

      if (useWorkers) {
        // Distribute work to queue workers
        const batchId = uuidv4();
        await logMsg(`Publishing ${programs.length} programs to worker queue (batch: ${batchId})...`);
        
        const published = await this.queueService.publishPlatformSyncBatch(
          programs,
          'bounty-targets',
          batchId,
        );
        
        await logMsg(`Published ${published} jobs to worker queue. Workers will process asynchronously.`);
        result.successCount = published;
        result.duration = Date.now() - startTime;
        return result;
      }

      // In-process concurrent processing
      await logMsg(`Processing ${programs.length} programs with concurrency ${concurrency}...`);
      
      // Pre-fetch existing programs for deduplication (bulk query)
      const existingPrograms = await this.programModel.find(
        {},
        { platform: 1, handle: 1, bountyRange: 1, offersBounties: 1 },
      ).lean();
      
      const existingMap = new Map<string, any>();
      for (const p of existingPrograms) {
        existingMap.set(`${p.platform}:${p.handle}`, p);
      }
      await logMsg(`Loaded ${existingPrograms.length} existing programs for deduplication`);

      // Process in concurrent batches
      for (let i = 0; i < programs.length; i += batchSize) {
        const batch = programs.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(programs.length / batchSize);
        
        // Process batch with concurrency limit
        const batchResults = await this.processBatchConcurrent(
          batch,
          existingMap,
          concurrency,
          logMsg,
        );
        
        // Aggregate results
        result.newPrograms += batchResults.newPrograms;
        result.updatedPrograms += batchResults.updatedPrograms;
        result.newScopes += batchResults.newScopes;
        result.successCount! += batchResults.successCount;
        result.failureCount! += batchResults.failureCount;
        result.errors.push(...batchResults.errors);
        
        await logMsg(`Batch ${batchNum}/${totalBatches}: ${batchResults.successCount} success, ${batchResults.failureCount} failed`);
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: bounty-targets sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    
    await logMsg(
      `bounty-targets optimized sync completed in ${result.duration}ms - ` +
      `Success: ${result.successCount}, Failures: ${result.failureCount}, ` +
      `New: ${result.newPrograms}, Updated: ${result.updatedPrograms}, Scopes: ${result.newScopes}`
    );
    
    return result;
  }

  /**
   * Process a batch of programs concurrently
   */
  private async processBatchConcurrent(
    programs: BountyTargetsProgram[],
    existingMap: Map<string, any>,
    concurrency: number,
    logMsg: LogFn,
  ): Promise<{
    newPrograms: number;
    updatedPrograms: number;
    newScopes: number;
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    const results = {
      newPrograms: 0,
      updatedPrograms: 0,
      newScopes: 0,
      successCount: 0,
      failureCount: 0,
      errors: [] as string[],
    };

    // Process with concurrency limit using a simple semaphore pattern
    const chunks: BountyTargetsProgram[][] = [];
    for (let i = 0; i < programs.length; i += concurrency) {
      chunks.push(programs.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (program) => {
        try {
          const validPlatforms = ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'yeswehack', 'federacy', 'github'];
          const platform = validPlatforms.includes(program.platform?.toLowerCase())
            ? program.platform.toLowerCase()
            : 'other';
          
          const key = `${platform}:${program.handle}`;
          const existing = existingMap.get(key);

          if (existing) {
            // Update existing program
            const updateFields: Record<string, any> = { lastSyncedAt: new Date() };
            
            if (program.maxBounty != null && !existing.bountyRange?.max) {
              updateFields.bountyRange = { max: program.maxBounty };
            }
            if (program.offersBounties && !existing.offersBounties) {
              updateFields.offersBounties = true;
            }
            
            await this.programModel.updateOne(
              { _id: existing._id },
              {
                $addToSet: { dataSources: 'bounty-targets' },
                $set: updateFields,
              },
            );
            
            const scopeCount = await this.syncBountyTargetsScopesBulk(existing._id, program);
            
            return { isNew: false, scopeCount, error: null };
          }

          // Create new program
          const { isNew, programId } = await this.upsertBountyTargetsProgram(program);
          const scopeCount = await this.syncBountyTargetsScopesBulk(programId, program);
          
          if (isNew) {
            await logMsg(`NEW: ${program.name} (${program.handle}) [${program.platform}]`);
            // Don't await notification to avoid blocking
            this.notifyNewProgram(program.name, program.platform).catch(() => {});
          }
          
          return { isNew, scopeCount, error: null };
        } catch (error: any) {
          return { isNew: false, scopeCount: 0, error: `${program.handle}: ${error.message}` };
        }
      });

      const chunkResults = await Promise.all(promises);
      
      for (const r of chunkResults) {
        if (r.error) {
          results.errors.push(r.error);
          results.failureCount++;
        } else {
          results.successCount++;
          if (r.isNew) {
            results.newPrograms++;
          } else {
            results.updatedPrograms++;
          }
          results.newScopes += r.scopeCount;
        }
      }
    }

    return results;
  }

  /**
   * Bulk sync scopes for better performance - uses bulk operations instead of individual inserts
   */
  private async syncBountyTargetsScopesBulk(
    programId: Types.ObjectId,
    program: BountyTargetsProgram,
  ): Promise<number> {
    const allScopes = [
      ...program.inScope.map(s => ({ ...s, status: ScopeStatus.IN_SCOPE })),
      ...program.outOfScope.map(s => ({ ...s, status: ScopeStatus.OUT_OF_SCOPE, eligibleForBounty: false })),
    ];

    if (allScopes.length === 0) return 0;

    // Get existing scopes in one query
    const existingScopes = await this.scopeModel.find(
      { programId },
      { target: 1 },
    ).lean();
    const existingTargets = new Set(existingScopes.map(s => s.target));

    // Filter to only new scopes
    const newScopes = allScopes.filter(s => !existingTargets.has(s.target));
    
    if (newScopes.length === 0) return 0;

    // Bulk insert new scopes
    const scopeDocs = newScopes.map(scope => ({
      programId,
      target: scope.target,
      type: this.mapBountyTargetsScopeType(scope.type),
      status: scope.status,
      description: scope.instruction,
      isActive: true,
      eligibility: {
        isEligible: scope.eligibleForBounty ?? (scope.status === ScopeStatus.IN_SCOPE),
      },
      firstSeenAt: new Date(),
    }));

    try {
      await this.scopeModel.insertMany(scopeDocs, { ordered: false });
    } catch (error: any) {
      // Ignore duplicate key errors from concurrent inserts
      if (error.code !== 11000 && !error.writeErrors) {
        throw error;
      }
    }

    // Bulk extract domains for in-scope items
    const inScopeDomains = newScopes
      .filter(s => s.status === ScopeStatus.IN_SCOPE)
      .map(s => ({ target: s.target, type: this.mapBountyTargetsScopeType(s.type) }))
      .filter(s => s.type === ScopeType.DOMAIN || s.type === ScopeType.WILDCARD);

    if (inScopeDomains.length > 0) {
      await this.extractDomainsBulk(programId, inScopeDomains);
    }

    return newScopes.length;
  }

  /**
   * Bulk extract and create domains
   */
  private async extractDomainsBulk(
    programId: Types.ObjectId,
    targets: { target: string; type: ScopeType }[],
  ): Promise<void> {
    const domainNames = targets.map(({ target }) => {
      let domain = target.toLowerCase();
      if (domain.startsWith('*.')) domain = domain.substring(2);
      domain = domain.replace(/^https?:\/\//, '').split('/')[0];
      return domain;
    }).filter(Boolean);

    const uniqueDomains = [...new Set(domainNames)];
    
    if (uniqueDomains.length === 0) return;

    // Bulk upsert domains
    const bulkOps = uniqueDomains.map(domain => ({
      updateOne: {
        filter: { domain },
        update: {
          $setOnInsert: {
            domain,
            programId,
            source: 'platform-sync',
            isActive: true,
            firstSeen: new Date(),
          },
          $set: { lastSeen: new Date() },
        },
        upsert: true,
      },
    }));

    try {
      await this.domainModel.bulkWrite(bulkOps, { ordered: false });
    } catch (error: any) {
      // Ignore duplicate key errors
      if (error.code !== 11000) {
        this.logger.warn(`Bulk domain insert warning: ${error.message}`);
      }
    }
  }

  /**
   * Upsert a bounty-targets program into the database
   * 
   * Requirements: 7.1 - Use platform + handle as unique identifier
   * Requirements: 7.3 - Use platform + handle as unique identifier for deduplication
   * Requirements: 7.4 - Preserve firstSyncedAt timestamp when updating
   * 
   * @param program The BountyTargetsProgram to upsert
   * @returns Object with isNew flag and programId
   */
  private async upsertBountyTargetsProgram(
    program: BountyTargetsProgram,
  ): Promise<{ isNew: boolean; programId: Types.ObjectId }> {
    // Use the actual platform from bounty-targets data
    // Map to valid enum values
    const validPlatforms = ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'yeswehack', 'federacy', 'github'];
    const platform = validPlatforms.includes(program.platform?.toLowerCase()) 
      ? program.platform.toLowerCase() 
      : 'other';
    
    const existing = await this.programModel.findOne({
      platform,
      handle: program.handle,
    });

    // Build enriched data object
    const enrichedData: Record<string, any> = {
      name: program.name,
      url: program.url,
      offersBounties: program.offersBounties,
      lastSyncedAt: new Date(),
    };

    // Store bounty range if available
    if (program.maxBounty != null) {
      enrichedData.bountyRange = {
        max: program.maxBounty,
      };
    }

    // Data source identifier for bounty-targets-data repository
    const dataSource = 'bounty-targets';

    if (existing) {
      // Update existing program, preserving firstSyncedAt (Requirement 7.4)
      // Add data source to existing record if not already present
      await this.programModel.updateOne(
        { _id: existing._id },
        { 
          $set: enrichedData,
          $addToSet: { dataSources: dataSource },
        },
      );
      return { isNew: false, programId: existing._id };
    }

    // Create new program
    const newProgram = await this.programModel.create({
      platform,
      handle: program.handle,
      ...enrichedData,
      isActive: true,
      scope: [],
      outOfScope: [],
      dataSources: [dataSource],
      firstSyncedAt: new Date(),
    });

    return { isNew: true, programId: newProgram._id };
  }

  /**
   * Sync scopes from bounty-targets data for a program
   * 
   * Requirements: 3.1 - Identify domain-type targets
   * Requirements: 3.2 - Extract base domain from wildcards
   * Requirements: 3.3 - Extract domain from URLs
   * Requirements: 3.4 - Create Domain entities linked to parent program
   * Requirements: 3.6 - Distinguish between in-scope and out-of-scope targets
   * 
   * @param programId The program's ObjectId
   * @param program The BountyTargetsProgram with scope data
   * @returns Number of new scopes created
   */
  private async syncBountyTargetsScopes(
    programId: Types.ObjectId,
    program: BountyTargetsProgram,
  ): Promise<number> {
    let newScopes = 0;

    // Process in-scope targets
    for (const scope of program.inScope) {
      const scopeType = this.mapBountyTargetsScopeType(scope.type);
      
      const existing = await this.scopeModel.findOne({
        programId,
        target: scope.target,
      });

      if (!existing) {
        await this.scopeModel.create({
          programId,
          target: scope.target,
          type: scopeType,
          status: ScopeStatus.IN_SCOPE,
          description: scope.instruction,
          isActive: true,
          eligibility: {
            isEligible: scope.eligibleForBounty ?? true,
          },
          firstSeenAt: new Date(),
        });
        newScopes++;

        // Extract and create domain for domain-type targets
        await this.extractAndCreateDomain(programId, scope.target, scopeType);
      }
    }

    // Process out-of-scope targets
    for (const scope of program.outOfScope) {
      const scopeType = this.mapBountyTargetsScopeType(scope.type);
      
      const existing = await this.scopeModel.findOne({
        programId,
        target: scope.target,
      });

      if (!existing) {
        await this.scopeModel.create({
          programId,
          target: scope.target,
          type: scopeType,
          status: ScopeStatus.OUT_OF_SCOPE,
          description: scope.instruction,
          isActive: true,
          eligibility: {
            isEligible: false,
          },
          firstSeenAt: new Date(),
        });
        newScopes++;
        // Don't extract domains for out-of-scope targets
      }
    }

    return newScopes;
  }

  /**
   * Map bounty-targets scope type to internal ScopeType
   * 
   * @param type The bounty-targets scope type string
   * @returns The corresponding ScopeType enum value
   */
  private mapBountyTargetsScopeType(type: string): ScopeType {
    const normalizedType = type?.toLowerCase() || '';
    
    const mapping: Record<string, ScopeType> = {
      'url': ScopeType.DOMAIN,
      'website': ScopeType.DOMAIN,
      'web-application': ScopeType.DOMAIN,
      'wildcard': ScopeType.WILDCARD,
      'api': ScopeType.API,
      'android': ScopeType.MOBILE_APP,
      'ios': ScopeType.MOBILE_APP,
      'mobile': ScopeType.MOBILE_APP,
      'cidr': ScopeType.IP_RANGE,
      'ip': ScopeType.IP,
      'other': ScopeType.OTHER,
    };
    
    return mapping[normalizedType] || ScopeType.OTHER;
  }

  private async upsertProgram(
    h1Program: HackerOneProgram,
    platform: string,
  ): Promise<{ isNew: boolean; programId: Types.ObjectId }> {
    const existing = await this.programModel.findOne({
      platform,
      handle: h1Program.handle,
    });

    // Build enriched data object, preserving null values for missing data
    // Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4
    const enrichedData: Record<string, any> = {
      name: h1Program.name,
      url: h1Program.url,
      state: h1Program.state,
      offersBounties: h1Program.offersBounties,
      lastSyncedAt: new Date(),
    };

    // Store bountyTable - preserve null for missing data (Requirement 1.4)
    if (h1Program.bountyTable !== undefined) {
      enrichedData.bountyTable = h1Program.bountyTable;
    }

    // Store responseMetrics - preserve null for missing data (Requirement 2.4)
    if (h1Program.responseMetrics !== undefined) {
      enrichedData.responseMetrics = h1Program.responseMetrics;
    }

    // Store activityStats - preserve null for missing data
    if (h1Program.activityStats !== undefined) {
      enrichedData.activityStats = h1Program.activityStats;
    }

    // Store launchedAt - convert string to Date if present (Requirement 3.4)
    if (h1Program.launchedAt !== undefined) {
      enrichedData.launchedAt = h1Program.launchedAt ? new Date(h1Program.launchedAt) : null;
    }

    // Data source identifier for HackerOne direct API
    const dataSource = 'hackerone-api';

    if (existing) {
      // Add data source to existing record if not already present
      await this.programModel.updateOne(
        { _id: existing._id },
        { 
          $set: enrichedData,
          $addToSet: { dataSources: dataSource },
        },
      );
      return { isNew: false, programId: existing._id };
    }

    const program = await this.programModel.create({
      platform,
      handle: h1Program.handle,
      ...enrichedData,
      isActive: true,
      scope: [],
      outOfScope: [],
      dataSources: [dataSource],
      firstSyncedAt: new Date(),
    });

    return { isNew: true, programId: program._id };
  }

  private async upsertBugcrowdProgram(
    bcProgram: BugcrowdProgram,
  ): Promise<{ isNew: boolean; programId: Types.ObjectId }> {
    const existing = await this.programModel.findOne({
      platform: 'bugcrowd',
      handle: bcProgram.code,
    });

    // Build enriched data object, preserving null values for missing data
    // Requirements: 1.3, 4.1, 4.2, 4.3
    const enrichedData: Record<string, any> = {
      name: bcProgram.name,
      url: bcProgram.programUrl,
      state: bcProgram.status,
      lastSyncedAt: new Date(),
    };

    // Store bountyRange with null handling (Requirement 1.3)
    // Only set bountyRange if we have actual data
    enrichedData.bountyRange = {
      min: bcProgram.minRewards,
      max: bcProgram.maxRewards,
    };

    // Store scopeStats calculated from scopes (Requirements: 4.1, 4.2, 4.3)
    if (bcProgram.scopeStats) {
      enrichedData.scopeStats = bcProgram.scopeStats;
    }

    // Data source identifier for Bugcrowd direct API
    const dataSource = 'bugcrowd-api';

    if (existing) {
      // Add data source to existing record if not already present
      await this.programModel.updateOne(
        { _id: existing._id },
        { 
          $set: enrichedData,
          $addToSet: { dataSources: dataSource },
        },
      );
      return { isNew: false, programId: existing._id };
    }

    const program = await this.programModel.create({
      platform: 'bugcrowd',
      handle: bcProgram.code,
      ...enrichedData,
      offersBounties: bcProgram.maxRewards != null && bcProgram.maxRewards > 0,
      isActive: true,
      scope: [],
      outOfScope: [],
      dataSources: [dataSource],
      firstSyncedAt: new Date(),
    });

    return { isNew: true, programId: program._id };
  }

  private async syncHackerOneScopes(
    programId: Types.ObjectId,
    program: HackerOneProgram,
  ): Promise<number> {
    let newScopes = 0;

    for (const scope of program.scopes) {
      const scopeType = this.mapAssetType(scope.assetType);
      
      // Determine if in-scope based on eligibleForSubmission
      // eligibleForSubmission: false means OUT OF SCOPE
      // eligibleForSubmission: true (or undefined) means IN SCOPE
      const isInScope = scope.eligibleForSubmission === true;
      const scopeStatus = isInScope ? ScopeStatus.IN_SCOPE : ScopeStatus.OUT_OF_SCOPE;
      
      const existing = await this.scopeModel.findOne({
        programId,
        target: scope.assetIdentifier,
      });

      if (!existing) {
        // Create new scope
        await this.scopeModel.create({
          programId,
          target: scope.assetIdentifier,
          type: scopeType,
          status: scopeStatus,
          description: scope.instruction,
          isActive: true,
          eligibility: {
            isEligible: scope.eligibleForBounty,
          },
          firstSeenAt: new Date(),
        });
        newScopes++;

        // Only extract domain from in-scope items
        if (isInScope) {
          await this.extractAndCreateDomain(programId, scope.assetIdentifier, scopeType);
        }
      } else {
        // Update existing scope if status has changed
        if (existing.status !== scopeStatus) {
          await this.scopeModel.updateOne(
            { _id: existing._id },
            {
              status: scopeStatus,
              description: scope.instruction,
              'eligibility.isEligible': scope.eligibleForBounty,
            },
          );
          this.logger.log(`Updated scope ${scope.assetIdentifier}: ${existing.status} -> ${scopeStatus}`);
        }
      }
    }

    return newScopes;
  }

  private async syncBugcrowdScopes(
    programId: Types.ObjectId,
    program: BugcrowdProgram,
  ): Promise<number> {
    let newScopes = 0;

    for (const scope of program.scopes) {
      const existing = await this.scopeModel.findOne({
        programId,
        target: scope.uri,
      });

      if (!existing) {
        await this.scopeModel.create({
          programId,
          target: scope.uri,
          type: this.mapBugcrowdTargetType(scope.targetType),
          status: scope.inScope ? ScopeStatus.IN_SCOPE : ScopeStatus.OUT_OF_SCOPE,
          description: scope.name,
          isActive: true,
          firstSeenAt: new Date(),
        });
        newScopes++;

        // Only extract domain from in-scope items
        if (scope.inScope) {
          await this.extractAndCreateDomain(programId, scope.uri, ScopeType.DOMAIN);
        }
      }
    }

    return newScopes;
  }

  private async extractAndCreateDomain(
    programId: Types.ObjectId,
    target: string,
    scopeType: ScopeType,
  ): Promise<void> {
    if (scopeType !== ScopeType.DOMAIN && scopeType !== ScopeType.WILDCARD) {
      return;
    }

    let domain = target.toLowerCase();
    
    // Remove wildcard prefix
    if (domain.startsWith('*.')) {
      domain = domain.substring(2);
    }

    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');
    
    // Remove path
    domain = domain.split('/')[0];

    try {
      await this.domainModel.updateOne(
        { domain },
        {
          $setOnInsert: {
            domain,
            programId,
            source: 'platform-sync',
            isActive: true,
            firstSeen: new Date(),
          },
          $set: { lastSeen: new Date() },
        },
        { upsert: true },
      );
    } catch (error: any) {
      // Ignore duplicate key errors
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  private mapAssetType(assetType: string): ScopeType {
    const mapping: Record<string, ScopeType> = {
      URL: ScopeType.DOMAIN,
      WILDCARD: ScopeType.WILDCARD,
      CIDR: ScopeType.IP_RANGE,
      'GOOGLE PLAY APP': ScopeType.MOBILE_APP,
      'APPLE STORE APP': ScopeType.MOBILE_APP,
      API: ScopeType.API,
      OTHER: ScopeType.OTHER,
    };
    return mapping[assetType] || ScopeType.OTHER;
  }

  private mapBugcrowdTargetType(targetType: string): ScopeType {
    const mapping: Record<string, ScopeType> = {
      website: ScopeType.DOMAIN,
      api: ScopeType.API,
      android: ScopeType.MOBILE_APP,
      ios: ScopeType.MOBILE_APP,
      other: ScopeType.OTHER,
    };
    return mapping[targetType] || ScopeType.OTHER;
  }

  /**
   * Calculate scope statistics from an array of scopes
   * Requirements: 4.1, 4.2, 4.3
   * 
   * Counts scopes by type (domain, wildcard, API, mobile app)
   * Counts bounty-eligible scopes
   * Identifies wildcards by pattern matching (*.domain.com)
   * 
   * @param scopes Array of scope documents
   * @returns ScopeStats object with counts by type
   */
  calculateScopeStats(scopes: ScopeDocument[]): {
    totalAssets: number;
    wildcardCount: number;
    domainCount: number;
    apiCount: number;
    mobileAppCount: number;
    bountyEligibleCount: number;
  } {
    // Filter to only in-scope assets
    const inScopeAssets = scopes.filter(scope => scope.status === ScopeStatus.IN_SCOPE);
    
    let wildcardCount = 0;
    let domainCount = 0;
    let apiCount = 0;
    let mobileAppCount = 0;
    let bountyEligibleCount = 0;

    for (const scope of inScopeAssets) {
      const target = scope.target || '';
      const scopeType = scope.type;

      // Check for wildcard pattern (*.domain.com) - Requirements: 4.2
      // A scope is a wildcard if:
      // 1. Its type is explicitly WILDCARD, OR
      // 2. Its target starts with '*.' or contains '*'
      const isWildcard = 
        scopeType === ScopeType.WILDCARD ||
        target.startsWith('*.') ||
        target.includes('*');

      if (isWildcard) {
        wildcardCount++;
      }

      // Count by type - Requirements: 4.1
      switch (scopeType) {
        case ScopeType.API:
          apiCount++;
          break;
        case ScopeType.MOBILE_APP:
          mobileAppCount++;
          break;
        case ScopeType.DOMAIN:
        case ScopeType.URL:
        case ScopeType.WILDCARD:
          domainCount++;
          break;
        // IP, IP_RANGE, OTHER are counted in totalAssets but not in specific categories
      }

      // Count bounty-eligible scopes - Requirements: 4.3
      if (scope.eligibility?.isEligible === true) {
        bountyEligibleCount++;
      }
    }

    return {
      totalAssets: inScopeAssets.length,
      wildcardCount,
      domainCount,
      apiCount,
      mobileAppCount,
      bountyEligibleCount,
    };
  }

  private async notifyNewProgram(name: string, platform: string): Promise<void> {
    await this.queueService.publishNotification({
      type: 'new_subdomain', // Reuse notification type for new programs
      data: {
        message: `New ${platform} program: ${name}`,
        platform,
        programName: name,
      },
      channels: ['discord'],
    });
  }

  private async notifySync(results: SyncResult[]): Promise<void> {
    const totalNew = results.reduce((acc, r) => acc + r.newPrograms, 0);
    const totalUpdated = results.reduce((acc, r) => acc + r.updatedPrograms, 0);
    const totalScopes = results.reduce((acc, r) => acc + r.newScopes, 0);

    if (totalNew > 0 || totalScopes > 0) {
      this.logger.log(`Sync complete: ${totalNew} new programs, ${totalUpdated} updated, ${totalScopes} new scopes`);
    }
  }
}

