import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Endpoint, EndpointDocument } from '../../schemas/endpoint.schema';
import { CreateSubdomainDto, UpdateSubdomainDto } from './dto/subdomain.dto';

@Injectable()
export class SubdomainsService {
  constructor(
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Endpoint.name) private endpointModel: Model<EndpointDocument>,
  ) {}

  async create(createSubdomainDto: CreateSubdomainDto): Promise<SubdomainDocument> {
    const subdomain = await this.subdomainModel.create({
      ...createSubdomainDto,
      subdomain: createSubdomainDto.subdomain.toLowerCase(),
      domainId: new Types.ObjectId(createSubdomainDto.domainId),
      firstSeen: new Date(),
      lastSeen: new Date(),
      isNew: true,
    });

    // Update domain count
    await this.updateDomainCount(createSubdomainDto.domainId);

    return subdomain;
  }

  async createOrUpdate(subdomainData: CreateSubdomainDto): Promise<SubdomainDocument> {
    const existing = await this.subdomainModel.findOne({
      subdomain: subdomainData.subdomain.toLowerCase(),
    });

    if (existing) {
      // Update existing subdomain
      Object.assign(existing, {
        ...subdomainData,
        lastSeen: new Date(),
        isNew: false,
      });
      return existing.save();
    }

    return this.create(subdomainData);
  }

  async bulkCreate(subdomains: CreateSubdomainDto[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const sub of subdomains) {
      const existing = await this.subdomainModel.findOne({
        subdomain: sub.subdomain.toLowerCase(),
      });

      if (existing) {
        await this.subdomainModel.updateOne(
          { _id: existing._id },
          { $set: { ...sub, lastSeen: new Date(), isNew: false } },
        );
        updated++;
      } else {
        await this.subdomainModel.create({
          ...sub,
          subdomain: sub.subdomain.toLowerCase(),
          domainId: new Types.ObjectId(sub.domainId),
          firstSeen: new Date(),
          lastSeen: new Date(),
          isNew: true,
        });
        created++;
      }
    }

    // Update domain counts
    const domainIds = [...new Set(subdomains.map((s) => s.domainId))];
    for (const domainId of domainIds) {
      await this.updateDomainCount(domainId);
    }

    return { created, updated };
  }

  async findAll(filters?: {
    domainId?: string;
    programId?: string;
    isAlive?: boolean;
    hasVulnerabilities?: boolean;
    httpStatus?: string;
    hasCdn?: boolean;
    cdn?: string;
    technology?: string;
    source?: string;
    isNew?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: SubdomainDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const query: any = {};
    const page = filters?.page || 1;
    // Allow higher limits for internal service calls (up to 10000), default 50 for API
    const limit = Math.min(filters?.limit || 50, 10000);
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;

    if (filters?.domainId) {
      query.domainId = new Types.ObjectId(filters.domainId);
    }
    if (filters?.programId) {
      // Find all domains for this program first
      const domains = await this.domainModel.find({ programId: new Types.ObjectId(filters.programId) }).select('_id');
      const domainIds = domains.map(d => d._id);
      query.domainId = { $in: domainIds };
    }
    if (filters?.isAlive !== undefined) {
      query.isAlive = filters.isAlive;
    }
    if (filters?.hasVulnerabilities) {
      query.vulnerabilityCount = { $gt: 0 };
    }
    if (filters?.httpStatus) {
      const status = parseInt(filters.httpStatus, 10);
      if (!isNaN(status)) {
        query.httpStatus = status;
      }
    }
    if (filters?.hasCdn !== undefined) {
      if (filters.hasCdn) {
        query.cdn = { $exists: true, $ne: [] };
      } else {
        query.$or = [{ cdn: { $exists: false } }, { cdn: [] }];
      }
    }
    if (filters?.cdn) {
      query.cdn = { $in: [filters.cdn] };
    }
    if (filters?.technology) {
      query.technologies = { $in: [filters.technology] };
    }
    if (filters?.source) {
      query.sources = { $in: [filters.source] };
    }
    if (filters?.search) {
      query.subdomain = { $regex: filters.search, $options: 'i' };
    }
    if (filters?.isNew !== undefined) {
      query.isNew = filters.isNew;
    }

    const [data, total] = await Promise.all([
      this.subdomainModel
        .find(query)
        .populate({
          path: 'domainId',
          select: 'domain programId',
          populate: {
            path: 'programId',
            select: 'name handle platform',
          },
        })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.subdomainModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: string): Promise<SubdomainDocument> {
    const subdomain = await this.subdomainModel
      .findById(id)
      .populate({
        path: 'domainId',
        select: 'domain programId',
        populate: {
          path: 'programId',
          select: 'name handle platform',
        },
      })
      .exec();
    if (!subdomain) {
      throw new NotFoundException('Subdomain not found');
    }
    return subdomain;
  }

  async findBySubdomain(subdomainName: string): Promise<SubdomainDocument | null> {
    return this.subdomainModel.findOne({ subdomain: subdomainName.toLowerCase() }).exec();
  }

  async update(id: string, updateSubdomainDto: UpdateSubdomainDto): Promise<SubdomainDocument> {
    const subdomain = await this.subdomainModel
      .findByIdAndUpdate(id, { ...updateSubdomainDto, lastSeen: new Date() }, { new: true })
      .exec();
    if (!subdomain) {
      throw new NotFoundException('Subdomain not found');
    }
    return subdomain;
  }

  async delete(id: string): Promise<void> {
    const subdomain = await this.subdomainModel.findById(id);
    if (!subdomain) {
      throw new NotFoundException('Subdomain not found');
    }

    await this.subdomainModel.findByIdAndDelete(id);
    await this.endpointModel.deleteMany({ subdomainId: new Types.ObjectId(id) });
    await this.updateDomainCount(subdomain.domainId.toString());
  }

  async getEndpoints(id: string): Promise<EndpointDocument[]> {
    await this.findById(id);
    return this.endpointModel
      .find({ subdomainId: new Types.ObjectId(id) })
      .sort({ url: 1 })
      .exec();
  }

  async getStats(id: string): Promise<any> {
    const subdomain = await this.findById(id);
    const subdomainObjectId = new Types.ObjectId(id);

    const [endpointCount, portStats] = await Promise.all([
      this.endpointModel.countDocuments({ subdomainId: subdomainObjectId }),
      this.subdomainModel.findById(id).select('ports').exec(),
    ]);

    return {
      subdomain,
      endpointCount,
      portCount: portStats?.ports?.length || 0,
      technologyCount: subdomain.technologies?.length || 0,
    };
  }

  async getNewSubdomains(domainId: string, since?: Date): Promise<SubdomainDocument[]> {
    const query: any = {
      domainId: new Types.ObjectId(domainId),
      isNew: true,
    };

    if (since) {
      query.firstSeen = { $gte: since };
    }

    return this.subdomainModel.find(query).sort({ firstSeen: -1 }).exec();
  }

  async markAsNotNew(ids: string[]): Promise<void> {
    await this.subdomainModel.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { $set: { isNew: false } },
    );
  }

  async getOverviewStats(): Promise<{
    total: number;
    alive: number;
    dead: number;
    withWaf: number;
    withVulnerabilities: number;
    newToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, alive, withWaf, withVulnerabilities, newToday] = await Promise.all([
      this.subdomainModel.countDocuments(),
      this.subdomainModel.countDocuments({ isAlive: true }),
      this.subdomainModel.countDocuments({ waf: { $exists: true, $ne: [] } }),
      this.subdomainModel.countDocuments({ vulnerabilityCount: { $gt: 0 } }),
      this.subdomainModel.countDocuments({ firstSeen: { $gte: today } }),
    ]);

    return {
      total,
      alive,
      dead: total - alive,
      withWaf,
      withVulnerabilities,
      newToday,
    };
  }

  // Cache for filter options (5 minute TTL)
  private filterOptionsCache: {
    data: any;
    timestamp: number;
  } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getFilterOptions(): Promise<{
    technologies: string[];
    sources: string[];
    cdns: string[];
    httpStatuses: number[];
    domains: { _id: string; domain: string }[];
    programs: { _id: string; name: string }[];
  }> {
    // Return cached data if still valid
    if (
      this.filterOptionsCache &&
      Date.now() - this.filterOptionsCache.timestamp < this.CACHE_TTL
    ) {
      return this.filterOptionsCache.data;
    }

    // Use aggregation pipeline for better performance - limit results
    const [technologies, sources, cdns, httpStatuses, domains] = await Promise.all([
      this.subdomainModel.distinct('technologies').then((t) => t.slice(0, 100)),
      this.subdomainModel.distinct('sources').then((s) => s.slice(0, 50)),
      this.subdomainModel.distinct('cdn').then((c) => c.slice(0, 50)),
      this.subdomainModel.distinct('httpStatus').then((h) => h.slice(0, 20)),
      this.domainModel
        .find()
        .select('_id domain programId')
        .populate('programId', 'name')
        .limit(500)
        .lean(),
    ]);

    // Extract unique programs from domains
    const programMap = new Map<string, string>();
    domains.forEach((d: any) => {
      if (d.programId && d.programId._id) {
        programMap.set(d.programId._id.toString(), d.programId.name);
      }
    });
    const programs = Array.from(programMap.entries()).map(([_id, name]) => ({
      _id,
      name,
    }));

    const result = {
      technologies: technologies.filter(Boolean).sort(),
      sources: sources.filter(Boolean).sort(),
      cdns: cdns.filter(Boolean).sort(),
      httpStatuses: httpStatuses.filter(Boolean).sort((a, b) => a - b),
      domains: domains.map((d: any) => ({
        _id: d._id.toString(),
        domain: d.domain,
      })),
      programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
    };

    // Cache the result
    this.filterOptionsCache = {
      data: result,
      timestamp: Date.now(),
    };

    return result;
  }

  async getTechnologies(filters?: {
    domain?: string;
    programId?: string;
    limit?: number;
  }): Promise<{ technology: string; count: number }[]> {
    const matchStage: any = {};

    if (filters?.domain) {
      const domain = await this.domainModel.findOne({ domain: filters.domain.toLowerCase() });
      if (domain) {
        matchStage.domainId = domain._id;
      }
    }

    if (filters?.programId) {
      const domains = await this.domainModel.find({ programId: new Types.ObjectId(filters.programId) }).select('_id');
      matchStage.domainId = { $in: domains.map(d => d._id) };
    }

    const pipeline: any[] = [
      { $match: { technologies: { $exists: true, $ne: [] }, ...matchStage } },
      { $unwind: '$technologies' },
      { $group: { _id: '$technologies', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];

    if (filters?.limit) {
      pipeline.push({ $limit: filters.limit });
    }

    const results = await this.subdomainModel.aggregate(pipeline);
    return results.map(r => ({ technology: r._id, count: r.count }));
  }

  private async updateDomainCount(domainId: string): Promise<void> {
    const count = await this.subdomainModel.countDocuments({
      domainId: new Types.ObjectId(domainId),
    });
    await this.domainModel.findByIdAndUpdate(domainId, { subdomainCount: count });
  }
}

