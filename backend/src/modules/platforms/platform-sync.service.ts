import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Scope, ScopeDocument, ScopeType, ScopeStatus } from '../../schemas/scope.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { HackerOneService, HackerOneProgram } from './services/hackerone.service';
import { BugcrowdService, BugcrowdProgram } from './services/bugcrowd.service';
import { QueueService } from '../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';

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

  async syncAllPlatforms(log?: LogFn): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const logMsg = log || (async (msg: string) => this.logger.log(msg));

    try {
      // Sync HackerOne
      await logMsg('Starting HackerOne sync...');
      const h1Result = await this.syncHackerOne(logMsg);
      results.push(h1Result);
      await logMsg(`HackerOne: ${h1Result.newPrograms} new, ${h1Result.updatedPrograms} updated, ${h1Result.newScopes} scopes`);

      // Sync Bugcrowd
      await logMsg('Starting Bugcrowd sync...');
      const bcResult = await this.syncBugcrowd(logMsg);
      results.push(bcResult);
      await logMsg(`Bugcrowd: ${bcResult.newPrograms} new, ${bcResult.updatedPrograms} updated, ${bcResult.newScopes} scopes`);

      // Send notification about sync results
      await this.notifySync(results);
      
      const totalNew = results.reduce((acc, r) => acc + r.newPrograms, 0);
      const totalScopes = results.reduce((acc, r) => acc + r.newScopes, 0);
      await logMsg(`Total: ${totalNew} new programs, ${totalScopes} new scopes`);
    } catch (error: any) {
      await logMsg(`ERROR: Platform sync failed: ${error.message}`);
      this.logger.error(`Platform sync failed: ${error.message}`);
    }

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

    if (existing) {
      await this.programModel.updateOne(
        { _id: existing._id },
        { $set: enrichedData },
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

    if (existing) {
      await this.programModel.updateOne(
        { _id: existing._id },
        { $set: enrichedData },
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

