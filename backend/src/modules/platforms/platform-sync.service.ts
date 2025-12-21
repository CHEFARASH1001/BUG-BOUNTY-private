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
}

export type LogFn = (message: string) => Promise<void>;

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
    };

    try {
      await logMsg('Fetching HackerOne public programs...');
      const programs = await this.hackerOneService.getPublicPrograms();
      await logMsg(`Found ${programs.length} HackerOne programs`);

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
        } catch (error: any) {
          result.errors.push(`${program.handle}: ${error.message}`);
          await logMsg(`ERROR: ${program.handle}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: HackerOne sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    await logMsg(`HackerOne sync completed in ${result.duration}ms`);
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
    };

    try {
      await logMsg('Fetching Bugcrowd public programs...');
      const programs = await this.bugcrowdService.fetchPublicPrograms();
      await logMsg(`Found ${programs.length} Bugcrowd programs`);

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
        } catch (error: any) {
          result.errors.push(`${program.code}: ${error.message}`);
          await logMsg(`ERROR: ${program.code}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
      await logMsg(`ERROR: Bugcrowd sync failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    await logMsg(`Bugcrowd sync completed in ${result.duration}ms`);
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

    if (existing) {
      await this.programModel.updateOne(
        { _id: existing._id },
        {
          name: h1Program.name,
          url: h1Program.url,
          state: h1Program.state,
          offersBounties: h1Program.offersBounties,
          lastSyncedAt: new Date(),
        },
      );
      return { isNew: false, programId: existing._id };
    }

    const program = await this.programModel.create({
      platform,
      handle: h1Program.handle,
      name: h1Program.name,
      url: h1Program.url,
      state: h1Program.state,
      offersBounties: h1Program.offersBounties,
      isActive: true,
      scope: [],
      outOfScope: [],
      firstSyncedAt: new Date(),
      lastSyncedAt: new Date(),
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

    if (existing) {
      await this.programModel.updateOne(
        { _id: existing._id },
        {
          name: bcProgram.name,
          url: bcProgram.programUrl,
          state: bcProgram.status,
          bountyRange: {
            min: bcProgram.minRewards,
            max: bcProgram.maxRewards,
          },
          lastSyncedAt: new Date(),
        },
      );
      return { isNew: false, programId: existing._id };
    }

    const program = await this.programModel.create({
      platform: 'bugcrowd',
      handle: bcProgram.code,
      name: bcProgram.name,
      url: bcProgram.programUrl,
      state: bcProgram.status,
      offersBounties: bcProgram.maxRewards > 0,
      bountyRange: {
        min: bcProgram.minRewards,
        max: bcProgram.maxRewards,
      },
      isActive: true,
      scope: [],
      outOfScope: [],
      firstSyncedAt: new Date(),
      lastSyncedAt: new Date(),
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

