import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Endpoint, EndpointDocument } from '../../schemas/endpoint.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';

@Injectable()
export class EndpointsService {
  constructor(
    @InjectModel(Endpoint.name) private endpointModel: Model<EndpointDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
  ) {}

  async create(endpointData: Partial<Endpoint>): Promise<EndpointDocument> {
    return this.endpointModel.create({
      ...endpointData,
      subdomainId: new Types.ObjectId(endpointData.subdomainId as any),
      domainId: endpointData.domainId ? new Types.ObjectId(endpointData.domainId as any) : undefined,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isNew: true,
    });
  }

  async createOrUpdate(url: string, subdomainId: string, data: Partial<Endpoint>): Promise<EndpointDocument> {
    const existing = await this.endpointModel.findOne({ url, subdomainId: new Types.ObjectId(subdomainId) });

    if (existing) {
      Object.assign(existing, { ...data, lastSeen: new Date(), isNew: false });
      return existing.save();
    }

    return this.create({ ...data, url, subdomainId: subdomainId as any });
  }

  async bulkCreate(endpoints: { url: string; subdomainId: string; data: Partial<Endpoint> }[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const ep of endpoints) {
      const existing = await this.endpointModel.findOne({
        url: ep.url,
        subdomainId: new Types.ObjectId(ep.subdomainId),
      });

      if (existing) {
        await this.endpointModel.updateOne(
          { _id: existing._id },
          { $set: { ...ep.data, lastSeen: new Date(), isNew: false } },
        );
        updated++;
      } else {
        await this.endpointModel.create({
          ...ep.data,
          url: ep.url,
          subdomainId: new Types.ObjectId(ep.subdomainId),
          firstSeen: new Date(),
          lastSeen: new Date(),
          isNew: true,
        });
        created++;
      }
    }

    return { created, updated };
  }

  async findAll(filters?: {
    subdomainId?: string;
    domainId?: string;
    isInteresting?: boolean;
    hasParams?: boolean;
    method?: string;
    statusCode?: number;
    search?: string;
  }): Promise<EndpointDocument[]> {
    const query: any = {};

    if (filters?.subdomainId) {
      query.subdomainId = new Types.ObjectId(filters.subdomainId);
    }
    if (filters?.domainId) {
      query.domainId = new Types.ObjectId(filters.domainId);
    }
    if (filters?.isInteresting !== undefined) {
      query.isInteresting = filters.isInteresting;
    }
    if (filters?.hasParams !== undefined) {
      query.hasParams = filters.hasParams;
    }
    if (filters?.method) {
      query.method = filters.method;
    }
    if (filters?.statusCode) {
      query.statusCode = filters.statusCode;
    }
    if (filters?.search) {
      query.url = { $regex: filters.search, $options: 'i' };
    }

    return this.endpointModel.find(query).sort({ url: 1 }).exec();
  }

  async findById(id: string): Promise<EndpointDocument> {
    const endpoint = await this.endpointModel.findById(id).exec();
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found');
    }
    return endpoint;
  }

  async update(id: string, data: Partial<Endpoint>): Promise<EndpointDocument> {
    const endpoint = await this.endpointModel
      .findByIdAndUpdate(id, { $set: { ...data, lastSeen: new Date() } }, { new: true })
      .exec();
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found');
    }
    return endpoint;
  }

  async delete(id: string): Promise<void> {
    const result = await this.endpointModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Endpoint not found');
    }
  }

  async getInteresting(subdomainId?: string): Promise<EndpointDocument[]> {
    const query: any = { isInteresting: true };
    if (subdomainId) {
      query.subdomainId = new Types.ObjectId(subdomainId);
    }
    return this.endpointModel.find(query).sort({ url: 1 }).exec();
  }

  async getWithParams(subdomainId?: string): Promise<EndpointDocument[]> {
    const query: any = { hasParams: true };
    if (subdomainId) {
      query.subdomainId = new Types.ObjectId(subdomainId);
    }
    return this.endpointModel.find(query).sort({ url: 1 }).exec();
  }

  async markAsInteresting(id: string, patterns: string[]): Promise<EndpointDocument> {
    const endpoint = await this.endpointModel
      .findByIdAndUpdate(
        id,
        {
          isInteresting: true,
          $addToSet: { interestingPatterns: { $each: patterns } },
        },
        { new: true },
      )
      .exec();
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found');
    }
    return endpoint;
  }

  async getStats(subdomainId?: string): Promise<any> {
    const match: any = {};
    if (subdomainId) {
      match.subdomainId = new Types.ObjectId(subdomainId);
    }

    const [total, interesting, withParams, byMethod, byStatus] = await Promise.all([
      this.endpointModel.countDocuments(match),
      this.endpointModel.countDocuments({ ...match, isInteresting: true }),
      this.endpointModel.countDocuments({ ...match, hasParams: true }),
      this.endpointModel.aggregate([
        { $match: match },
        { $group: { _id: '$method', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.endpointModel.aggregate([
        { $match: match },
        { $group: { _id: '$statusCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      total,
      interesting,
      withParams,
      byMethod,
      byStatus,
    };
  }
}

