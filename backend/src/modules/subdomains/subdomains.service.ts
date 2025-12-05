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
    isAlive?: boolean;
    hasVulnerabilities?: boolean;
    search?: string;
  }): Promise<SubdomainDocument[]> {
    const query: any = {};

    if (filters?.domainId) {
      query.domainId = new Types.ObjectId(filters.domainId);
    }
    if (filters?.isAlive !== undefined) {
      query.isAlive = filters.isAlive;
    }
    if (filters?.hasVulnerabilities) {
      query.vulnerabilityCount = { $gt: 0 };
    }
    if (filters?.search) {
      query.subdomain = { $regex: filters.search, $options: 'i' };
    }

    return this.subdomainModel
      .find(query)
      .populate('domainId', 'domain')
      .sort({ subdomain: 1 })
      .exec();
  }

  async findById(id: string): Promise<SubdomainDocument> {
    const subdomain = await this.subdomainModel
      .findById(id)
      .populate('domainId', 'domain programId')
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

  private async updateDomainCount(domainId: string): Promise<void> {
    const count = await this.subdomainModel.countDocuments({
      domainId: new Types.ObjectId(domainId),
    });
    await this.domainModel.findByIdAndUpdate(domainId, { subdomainCount: count });
  }
}

