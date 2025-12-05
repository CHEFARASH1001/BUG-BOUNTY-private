import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model, Types } from 'mongoose';
import { Queue } from 'bull';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Scan, ScanDocument, ScanType, ScanStatus } from '../../schemas/scan.schema';
import { CreateDomainDto, UpdateDomainDto } from './dto/domain.dto';

@Injectable()
export class DomainsService {
  constructor(
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Scan.name) private scanModel: Model<ScanDocument>,
    @InjectQueue('scans') private scansQueue: Queue,
  ) {}

  async create(createDomainDto: CreateDomainDto): Promise<DomainDocument> {
    // Check if domain already exists
    const existing = await this.domainModel.findOne({
      domain: createDomainDto.domain.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('Domain already exists');
    }

    const domain = await this.domainModel.create({
      ...createDomainDto,
      domain: createDomainDto.domain.toLowerCase(),
      programId: new Types.ObjectId(createDomainDto.programId),
    });

    // If autoScan is enabled, queue a full scan
    if (createDomainDto.autoScan) {
      await this.startFullScan(domain._id.toString());
    }

    return domain;
  }

  async findAll(filters?: {
    programId?: string;
    status?: string;
    search?: string;
  }): Promise<DomainDocument[]> {
    const query: any = {};

    if (filters?.programId) {
      query.programId = new Types.ObjectId(filters.programId);
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.search) {
      query.domain = { $regex: filters.search, $options: 'i' };
    }

    return this.domainModel
      .find(query)
      .populate('programId', 'name platform')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<DomainDocument> {
    const domain = await this.domainModel
      .findById(id)
      .populate('programId', 'name platform')
      .exec();
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }

  async findByDomain(domainName: string): Promise<DomainDocument | null> {
    return this.domainModel.findOne({ domain: domainName.toLowerCase() }).exec();
  }

  async update(id: string, updateDomainDto: UpdateDomainDto): Promise<DomainDocument> {
    const domain = await this.domainModel
      .findByIdAndUpdate(id, updateDomainDto, { new: true })
      .exec();
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }

  async delete(id: string): Promise<void> {
    const result = await this.domainModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Domain not found');
    }
    // Delete associated subdomains
    await this.subdomainModel.deleteMany({ domainId: new Types.ObjectId(id) }).exec();
  }

  async getSubdomains(id: string): Promise<SubdomainDocument[]> {
    await this.findById(id);
    return this.subdomainModel
      .find({ domainId: new Types.ObjectId(id) })
      .sort({ subdomain: 1 })
      .exec();
  }

  async getStats(id: string): Promise<any> {
    const domain = await this.findById(id);
    const domainObjectId = new Types.ObjectId(id);

    const [subdomainCount, aliveCount, recentScans] = await Promise.all([
      this.subdomainModel.countDocuments({ domainId: domainObjectId }),
      this.subdomainModel.countDocuments({ domainId: domainObjectId, isAlive: true }),
      this.scanModel
        .find({ targetId: domainObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .exec(),
    ]);

    const techStats = await this.subdomainModel.aggregate([
      { $match: { domainId: domainObjectId } },
      { $unwind: '$technologies' },
      { $group: { _id: '$technologies', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      domain,
      subdomainCount,
      aliveCount,
      deadCount: subdomainCount - aliveCount,
      technologies: techStats,
      recentScans,
    };
  }

  async startFullScan(id: string, userId?: string): Promise<any> {
    const domain = await this.findById(id);

    // Create scan record
    const scan = await this.scanModel.create({
      type: ScanType.FULL,
      targetId: domain._id,
      targetType: 'domain',
      target: domain.domain,
      status: ScanStatus.QUEUED,
      initiatedBy: userId ? new Types.ObjectId(userId) : undefined,
      config: {
        includeSubdomains: true,
        includePorts: true,
        includeNuclei: true,
        includeScreenshots: true,
        includeTechnologies: true,
      },
    });

    // Queue the scan job
    const job = await this.scansQueue.add(
      'full-scan',
      {
        scanId: scan._id.toString(),
        domainId: id,
        domain: domain.domain,
      },
      {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    // Update scan with job ID
    scan.jobId = job.id.toString();
    await scan.save();

    // Update domain status
    await this.domainModel.findByIdAndUpdate(id, { status: 'scanning' });

    return {
      message: 'Full scan started',
      scanId: scan._id,
      jobId: job.id,
    };
  }

  async updateDnsRecords(id: string, dnsRecords: any): Promise<void> {
    await this.domainModel.findByIdAndUpdate(id, { dnsRecords });
  }

  async updateWhois(id: string, whois: any): Promise<void> {
    await this.domainModel.findByIdAndUpdate(id, { whois });
  }

  async updateSsl(id: string, ssl: any): Promise<void> {
    await this.domainModel.findByIdAndUpdate(id, { ssl });
  }

  async updateCounts(id: string): Promise<void> {
    const domainObjectId = new Types.ObjectId(id);
    const subdomainCount = await this.subdomainModel.countDocuments({
      domainId: domainObjectId,
    });
    await this.domainModel.findByIdAndUpdate(id, { subdomainCount });
  }
}

