import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { HttpService as HttpServiceSchema, HttpServiceDocument } from '../../schemas/http-service.schema';
import { Live, LiveDocument } from '../../schemas/live.schema';

export interface HttpServicesFilter {
  domain?: string;
  subdomain?: string;
  programId?: string;
  statusCode?: number;
  tech?: string;
  title?: string;
  provider?: string;
  isFresh?: boolean;
  isCdn?: boolean;
  statusCodeChanged?: boolean;
  titleChanged?: boolean;
  techChanged?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface HttpServicesStats {
  total: number;
  fresh: number;
  statusCodes: Record<number, number>;
  technologies: { name: string; count: number }[];
  statusCodeChanges: number;
  titleChanges: number;
  techChanges: number;
}

export interface ComparisonResult {
  subdomain: string;
  url: string;
  changes: {
    field: string;
    previous: any;
    current: any;
  }[];
}

@Injectable()
export class HttpServicesService {
  private readonly logger = new Logger(HttpServicesService.name);

  constructor(
    @InjectModel(HttpServiceSchema.name) private httpServiceModel: Model<HttpServiceDocument>,
    @InjectModel(Live.name) private liveModel: Model<LiveDocument>,
  ) {}

  async findAll(filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    const query = this.buildQuery(filter);
    
    let queryBuilder = this.httpServiceModel.find(query);

    if (filter.sort) {
      const sortOrder = filter.sort.startsWith('-') ? -1 : 1;
      const sortField = filter.sort.replace(/^-/, '');
      queryBuilder = queryBuilder.sort({ [sortField]: sortOrder });
    } else {
      queryBuilder = queryBuilder.sort({ scannedAt: -1 });
    }

    if (filter.offset) {
      queryBuilder = queryBuilder.skip(filter.offset);
    }

    if (filter.limit) {
      queryBuilder = queryBuilder.limit(filter.limit);
    }

    return queryBuilder.exec();
  }

  async findFresh(filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    return this.findAll({ ...filter, isFresh: true });
  }

  async findByDomain(domain: string, filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    return this.findAll({ ...filter, domain: domain.toLowerCase() });
  }

  async findByTechnology(tech: string, filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    return this.findAll({ ...filter, tech });
  }

  async findByTitle(title: string, filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    return this.findAll({ ...filter, title });
  }

  async findOne(urlOrSubdomain: string): Promise<HttpServiceDocument> {
    const query = urlOrSubdomain.startsWith('http')
      ? { url: urlOrSubdomain }
      : { subdomain: urlOrSubdomain.toLowerCase() };

    const service = await this.httpServiceModel.findOne(query).exec();
    if (!service) {
      throw new NotFoundException(`HTTP service not found: ${urlOrSubdomain}`);
    }
    return service;
  }

  async count(filter: HttpServicesFilter = {}): Promise<number> {
    const query = this.buildQuery(filter);
    return this.httpServiceModel.countDocuments(query).exec();
  }

  async getStats(filter: HttpServicesFilter = {}): Promise<HttpServicesStats> {
    const baseQuery = this.buildQuery(filter);

    const [total, fresh, statusCodesAgg, technologiesAgg, changes] = await Promise.all([
      this.httpServiceModel.countDocuments(baseQuery),
      this.httpServiceModel.countDocuments({ ...baseQuery, isFresh: true }),
      this.httpServiceModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$statusCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.httpServiceModel.aggregate([
        { $match: baseQuery },
        { $unwind: '$technologies' },
        { $group: { _id: '$technologies', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      Promise.all([
        this.httpServiceModel.countDocuments({ ...baseQuery, statusCodeChanged: true }),
        this.httpServiceModel.countDocuments({ ...baseQuery, titleChanged: true }),
        this.httpServiceModel.countDocuments({ ...baseQuery, techChanged: true }),
      ]),
    ]);

    const statusCodes: Record<number, number> = {};
    for (const sc of statusCodesAgg) {
      if (sc._id) {
        statusCodes[sc._id] = sc.count;
      }
    }

    const technologies = technologiesAgg.map(t => ({
      name: t._id,
      count: t.count,
    }));

    return {
      total,
      fresh,
      statusCodes,
      technologies,
      statusCodeChanges: changes[0],
      titleChanges: changes[1],
      techChanges: changes[2],
    };
  }

  async getTechnologies(filter: HttpServicesFilter = {}): Promise<{ name: string; count: number }[]> {
    const baseQuery = this.buildQuery(filter);

    const result = await this.httpServiceModel.aggregate([
      { $match: baseQuery },
      { $unwind: '$technologies' },
      { $group: { _id: '$technologies', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return result.map(t => ({
      name: t._id,
      count: t.count,
    }));
  }

  async upsertHttpService(data: Partial<HttpServiceSchema>): Promise<{ isNew: boolean; doc: HttpServiceDocument }> {
    const url = data.url;
    if (!url) {
      throw new Error('URL is required');
    }

    const existing = await this.httpServiceModel.findOne({ url });

    if (existing) {
      // Store previous scan data for comparison
      const previousScan = {
        statusCode: existing.statusCode,
        title: existing.title,
        technologies: existing.technologies,
        contentLength: existing.contentLength,
        bodyHash: existing.bodyHash,
        scannedAt: existing.scannedAt,
      };

      // Detect changes
      const statusCodeChanged = data.statusCode !== undefined && data.statusCode !== existing.statusCode;
      const titleChanged = data.title !== undefined && data.title !== existing.title;
      const techChanged = data.technologies !== undefined && 
        JSON.stringify(data.technologies?.sort()) !== JSON.stringify(existing.technologies?.sort());

      // Update existing
      Object.assign(existing, data);
      existing.previousScan = previousScan;
      existing.statusCodeChanged = statusCodeChanged;
      existing.titleChanged = titleChanged;
      existing.techChanged = techChanged;
      existing.lastSeen = new Date();
      existing.scannedAt = new Date();

      return { isNew: false, doc: await existing.save() };
    }

    // Create new
    const doc = await this.httpServiceModel.create({
      ...data,
      isFresh: true,
      firstSeen: new Date(),
      lastSeen: new Date(),
      scannedAt: new Date(),
    });

    return { isNew: true, doc };
  }

  async bulkUpsert(services: Partial<HttpServiceSchema>[]): Promise<{ created: number; updated: number; changes: ComparisonResult[] }> {
    let created = 0;
    let updated = 0;
    const changes: ComparisonResult[] = [];

    for (const service of services) {
      try {
        const { isNew, doc } = await this.upsertHttpService(service);
        
        if (isNew) {
          created++;
        } else {
          updated++;
          
          // Collect changes for notification
          if (doc.statusCodeChanged || doc.titleChanged || doc.techChanged) {
            const changeList: ComparisonResult['changes'] = [];
            
            if (doc.statusCodeChanged) {
              changeList.push({
                field: 'statusCode',
                previous: doc.previousScan?.statusCode,
                current: doc.statusCode,
              });
            }
            if (doc.titleChanged) {
              changeList.push({
                field: 'title',
                previous: doc.previousScan?.title,
                current: doc.title,
              });
            }
            if (doc.techChanged) {
              changeList.push({
                field: 'technologies',
                previous: doc.previousScan?.technologies,
                current: doc.technologies,
              });
            }

            changes.push({
              subdomain: doc.subdomain,
              url: doc.url,
              changes: changeList,
            });
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to upsert HTTP service ${service.url}: ${error.message}`);
      }
    }

    return { created, updated, changes };
  }

  async getChanges(filter: HttpServicesFilter = {}): Promise<HttpServiceDocument[]> {
    const query: FilterQuery<HttpServiceDocument> = {
      ...this.buildQuery(filter),
      $or: [
        { statusCodeChanged: true },
        { titleChanged: true },
        { techChanged: true },
      ],
    };

    return this.httpServiceModel.find(query).sort({ scannedAt: -1 }).exec();
  }

  async markAsNotFresh(olderThanHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await this.httpServiceModel.updateMany(
      { isFresh: true, firstSeen: { $lt: cutoff } },
      { $set: { isFresh: false } },
    );

    return result.modifiedCount;
  }

  async delete(url: string): Promise<void> {
    await this.httpServiceModel.deleteOne({ url });
  }

  async getUrlsForOutput(filter: HttpServicesFilter = {}): Promise<string[]> {
    const services = await this.findAll(filter);
    return services.map(s => s.url);
  }

  private buildQuery(filter: HttpServicesFilter): FilterQuery<HttpServiceDocument> {
    const query: FilterQuery<HttpServiceDocument> = {};

    if (filter.domain) {
      query.domain = filter.domain.toLowerCase();
    }

    if (filter.subdomain) {
      query.subdomain = filter.subdomain.toLowerCase();
    }

    if (filter.programId) {
      query.programId = new Types.ObjectId(filter.programId);
    }

    if (filter.statusCode) {
      query.statusCode = filter.statusCode;
    }

    if (filter.tech) {
      query.technologies = { $regex: new RegExp(filter.tech, 'i') };
    }

    if (filter.title) {
      query.title = { $regex: new RegExp(filter.title, 'i') };
    }

    if (filter.provider) {
      query.provider = filter.provider;
    }

    if (filter.isFresh !== undefined) {
      query.isFresh = filter.isFresh;
    }

    if (filter.isCdn !== undefined) {
      query.isCdn = filter.isCdn;
    }

    if (filter.statusCodeChanged !== undefined) {
      query.statusCodeChanged = filter.statusCodeChanged;
    }

    if (filter.titleChanged !== undefined) {
      query.titleChanged = filter.titleChanged;
    }

    if (filter.techChanged !== undefined) {
      query.techChanged = filter.techChanged;
    }

    return query;
  }
}

