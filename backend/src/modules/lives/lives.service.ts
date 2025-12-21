import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Live, LiveDocument } from '../../schemas/live.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';

export interface LivesFilter {
  domain?: string;
  programId?: string;
  scope?: string;
  isFresh?: boolean;
  isCdn?: boolean;
  provider?: string;
  ip?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface LivesStats {
  total: number;
  fresh: number;
  cdn: number;
  nonCdn: number;
  byProvider: Record<string, number>;
}

@Injectable()
export class LivesService {
  private readonly logger = new Logger(LivesService.name);

  constructor(
    @InjectModel(Live.name) private liveModel: Model<LiveDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
  ) {}

  async findAll(filter: LivesFilter = {}): Promise<LiveDocument[]> {
    const query = this.buildQuery(filter);
    
    let queryBuilder = this.liveModel.find(query);

    if (filter.sort) {
      const sortOrder = filter.sort.startsWith('-') ? -1 : 1;
      const sortField = filter.sort.replace(/^-/, '');
      queryBuilder = queryBuilder.sort({ [sortField]: sortOrder });
    } else {
      queryBuilder = queryBuilder.sort({ resolvedAt: -1 });
    }

    if (filter.offset) {
      queryBuilder = queryBuilder.skip(filter.offset);
    }

    if (filter.limit) {
      queryBuilder = queryBuilder.limit(filter.limit);
    }

    return queryBuilder.exec();
  }

  async findFresh(filter: LivesFilter = {}): Promise<LiveDocument[]> {
    return this.findAll({ ...filter, isFresh: true });
  }

  async findByScope(scope: string, filter: LivesFilter = {}): Promise<LiveDocument[]> {
    return this.findAll({ ...filter, scope });
  }

  async findByDomain(domain: string, filter: LivesFilter = {}): Promise<LiveDocument[]> {
    return this.findAll({ ...filter, domain: domain.toLowerCase() });
  }

  async findByProvider(provider: string, filter: LivesFilter = {}): Promise<LiveDocument[]> {
    return this.findAll({ ...filter, provider });
  }

  async findOne(subdomain: string): Promise<LiveDocument> {
    const live = await this.liveModel.findOne({ subdomain: subdomain.toLowerCase() }).exec();
    if (!live) {
      throw new NotFoundException(`Live host not found: ${subdomain}`);
    }
    return live;
  }

  async count(filter: LivesFilter = {}): Promise<number> {
    const query = this.buildQuery(filter);
    return this.liveModel.countDocuments(query).exec();
  }

  async getStats(filter: LivesFilter = {}): Promise<LivesStats> {
    const baseQuery = this.buildQuery(filter);

    const [total, fresh, cdn, nonCdn, providers] = await Promise.all([
      this.liveModel.countDocuments(baseQuery),
      this.liveModel.countDocuments({ ...baseQuery, isFresh: true }),
      this.liveModel.countDocuments({ ...baseQuery, isCdn: true }),
      this.liveModel.countDocuments({ ...baseQuery, isCdn: false }),
      this.liveModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$provider', count: { $sum: 1 } } },
      ]),
    ]);

    const byProvider: Record<string, number> = {};
    for (const p of providers) {
      if (p._id) {
        byProvider[p._id] = p.count;
      }
    }

    return { total, fresh, cdn, nonCdn, byProvider };
  }

  async upsertLive(data: Partial<Live>): Promise<LiveDocument> {
    const subdomain = data.subdomain?.toLowerCase();
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const existing = await this.liveModel.findOne({ subdomain });

    if (existing) {
      // Update existing
      Object.assign(existing, data);
      existing.lastSeen = new Date();
      return existing.save();
    }

    // Create new
    return this.liveModel.create({
      ...data,
      subdomain,
      isFresh: true,
      firstSeen: new Date(),
      lastSeen: new Date(),
      resolvedAt: new Date(),
    });
  }

  async bulkUpsert(lives: Partial<Live>[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const live of lives) {
      try {
        const subdomain = live.subdomain?.toLowerCase();
        if (!subdomain) continue;

        const result = await this.liveModel.updateOne(
          { subdomain },
          {
            $setOnInsert: {
              subdomain,
              domain: live.domain,
              programId: live.programId,
              isFresh: true,
              firstSeen: new Date(),
            },
            $set: {
              ip: live.ip,
              cname: live.cname,
              isCdn: live.isCdn,
              cdnProvider: live.cdnProvider,
              provider: live.provider,
              lastSeen: new Date(),
              resolvedAt: new Date(),
              dnsRecords: live.dnsRecords,
            },
          },
          { upsert: true },
        );

        if (result.upsertedCount > 0) {
          created++;
        } else if (result.modifiedCount > 0) {
          updated++;
        }
      } catch (error: any) {
        this.logger.error(`Failed to upsert live ${live.subdomain}: ${error.message}`);
      }
    }

    return { created, updated };
  }

  async markAsNotFresh(olderThanHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await this.liveModel.updateMany(
      { isFresh: true, firstSeen: { $lt: cutoff } },
      { $set: { isFresh: false } },
    );

    return result.modifiedCount;
  }

  async delete(subdomain: string): Promise<void> {
    await this.liveModel.deleteOne({ subdomain: subdomain.toLowerCase() });
  }

  async getSubdomainsForOutput(filter: LivesFilter = {}): Promise<string[]> {
    const lives = await this.findAll(filter);
    return lives.map(l => l.subdomain);
  }

  private buildQuery(filter: LivesFilter): FilterQuery<LiveDocument> {
    const query: FilterQuery<LiveDocument> = {};

    if (filter.domain) {
      query.domain = filter.domain.toLowerCase();
    }

    if (filter.programId) {
      query.programId = new Types.ObjectId(filter.programId);
    }

    if (filter.scope) {
      // Scope is matched by domain suffix
      query.domain = { $regex: new RegExp(`${filter.scope.replace(/\./g, '\\.')}$`, 'i') };
    }

    if (filter.isFresh !== undefined) {
      query.isFresh = filter.isFresh;
    }

    if (filter.isCdn !== undefined) {
      query.isCdn = filter.isCdn;
    }

    if (filter.provider) {
      query.provider = filter.provider;
    }

    if (filter.ip) {
      query.ip = filter.ip;
    }

    return query;
  }
}

