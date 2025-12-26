import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Scope, ScopeDocument, ScopeType, ScopeStatus } from '../../schemas/scope.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { QueueConstants } from '../queue/queue.constants';
import { BountyTargetsProgram, BountyTargetsScope } from './services/bounty-targets.service';

export interface PlatformSyncJobData {
  type: 'bounty-targets' | 'chaos';
  program: BountyTargetsProgram;
  batchId: string;
}

export interface PlatformSyncResult {
  handle: string;
  platform: string;
  isNew: boolean;
  scopesCreated: number;
  duration: number;
  error?: string;
}

/**
 * Worker for processing platform sync jobs from the queue
 * Handles individual program upserts in parallel across multiple workers
 */
@Injectable()
export class PlatformSyncWorker {
  private readonly logger = new Logger(PlatformSyncWorker.name);

  constructor(
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Scope.name) private scopeModel: Model<ScopeDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
  ) {}

  @RabbitSubscribe({
    exchange: QueueConstants.EXCHANGE_DIRECT,
    routingKey: QueueConstants.ROUTING_PLATFORM_SYNC,
    queue: QueueConstants.QUEUE_PLATFORM_SYNC,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': QueueConstants.EXCHANGE_DLX,
        'x-dead-letter-routing-key': QueueConstants.ROUTING_DLQ,
      },
    },
    createQueueIfNotExists: true,
  })
  async handlePlatformSyncJob(data: PlatformSyncJobData): Promise<void | Nack> {
    const startTime = Date.now();
    const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
    
    try {
      const result = await this.processProgram(data);
      const duration = Date.now() - startTime;
      
      if (result.isNew) {
        this.logger.log(
          `[${workerId}] ✓ NEW: ${data.program.handle} [${data.program.platform}] ` +
          `(${result.scopesCreated} scopes) in ${duration}ms`,
        );
      } else {
        this.logger.debug(
          `[${workerId}] ✓ Updated: ${data.program.handle} [${data.program.platform}] in ${duration}ms`,
        );
      }
    } catch (error: any) {
      this.logger.error(`[${workerId}] ✗ ${data.program.handle}: ${error.message}`);
      // Send to DLQ on failure
      return new Nack(false);
    }
  }

  private async processProgram(data: PlatformSyncJobData): Promise<PlatformSyncResult> {
    const { program } = data;
    const startTime = Date.now();

    // Map platform to valid enum
    const validPlatforms = ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'yeswehack', 'federacy', 'github'];
    const platform = validPlatforms.includes(program.platform?.toLowerCase())
      ? program.platform.toLowerCase()
      : 'other';

    // Check for existing program
    const existing = await this.programModel.findOne({
      platform,
      handle: program.handle,
    });

    const enrichedData: Record<string, any> = {
      name: program.name,
      url: program.url,
      offersBounties: program.offersBounties,
      lastSyncedAt: new Date(),
    };

    if (program.maxBounty != null) {
      enrichedData.bountyRange = { max: program.maxBounty };
    }

    const dataSource = 'bounty-targets';
    let programId: Types.ObjectId;
    let isNew = false;

    if (existing) {
      // Update existing - merge data
      const updateFields: Record<string, any> = { ...enrichedData };
      
      if (program.maxBounty != null && !existing.bountyRange?.max) {
        updateFields.bountyRange = { max: program.maxBounty };
      }
      if (program.offersBounties && !existing.offersBounties) {
        updateFields.offersBounties = true;
      }

      await this.programModel.updateOne(
        { _id: existing._id },
        {
          $set: updateFields,
          $addToSet: { dataSources: dataSource },
        },
      );
      programId = existing._id;
    } else {
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
      programId = newProgram._id;
      isNew = true;
    }

    // Sync scopes using bulk operations
    const scopesCreated = await this.syncScopesBulk(programId, program);

    return {
      handle: program.handle,
      platform,
      isNew,
      scopesCreated,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Bulk sync scopes for better performance
   */
  private async syncScopesBulk(
    programId: Types.ObjectId,
    program: BountyTargetsProgram,
  ): Promise<number> {
    const allScopes = [
      ...program.inScope.map(s => ({ ...s, status: ScopeStatus.IN_SCOPE })),
      ...program.outOfScope.map(s => ({ ...s, status: ScopeStatus.OUT_OF_SCOPE, eligibleForBounty: false })),
    ];

    if (allScopes.length === 0) return 0;

    // Get existing scopes for this program in one query
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
      type: this.mapScopeType(scope.type),
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

    // Extract domains for in-scope items (batch)
    const inScopeDomains = newScopes
      .filter(s => s.status === ScopeStatus.IN_SCOPE)
      .map(s => ({ target: s.target, type: this.mapScopeType(s.type) }))
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
    const domainDocs = targets.map(({ target }) => {
      let domain = target.toLowerCase();
      if (domain.startsWith('*.')) domain = domain.substring(2);
      domain = domain.replace(/^https?:\/\//, '').split('/')[0];
      return domain;
    }).filter(Boolean);

    const uniqueDomains = [...new Set(domainDocs)];
    
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

    if (bulkOps.length > 0) {
      try {
        await this.domainModel.bulkWrite(bulkOps, { ordered: false });
      } catch (error: any) {
        // Ignore duplicate key errors
        if (error.code !== 11000) {
          this.logger.warn(`Bulk domain insert warning: ${error.message}`);
        }
      }
    }
  }

  private mapScopeType(type: string): ScopeType {
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
}
