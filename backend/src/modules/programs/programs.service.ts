import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Vulnerability, VulnerabilityDocument } from '../../schemas/vulnerability.schema';
import { Scope, ScopeDocument } from '../../schemas/scope.schema';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
    @InjectModel(Scope.name) private scopeModel: Model<ScopeDocument>,
  ) {}

  async create(createProgramDto: CreateProgramDto, userId: string): Promise<ProgramDocument> {
    const program = await this.programModel.create({
      ...createProgramDto,
      createdBy: new Types.ObjectId(userId),
    });
    return program;
  }

  async findAll(filters?: {
    status?: string;
    platform?: string;
    search?: string;
    offersBounties?: string;
    dataSource?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const query: any = {};
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.platform) {
      // Case-insensitive platform matching
      query.platform = { $regex: new RegExp(`^${filters.platform}`, 'i') };
    }
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { handle: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters?.offersBounties !== undefined && filters.offersBounties !== '') {
      query.offersBounties = filters.offersBounties === 'true';
    }
    if (filters?.dataSource) {
      query.dataSources = filters.dataSource;
    }

    // Get total count for pagination
    const total = await this.programModel.countDocuments(query).exec();

    // Use aggregation to include scope counts with pagination
    const programs = await this.programModel.aggregate([
      { $match: query },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'scopes',
          localField: '_id',
          foreignField: 'programId',
          as: 'scopesList',
        },
      },
      {
        $addFields: {
          scopeCount: { $size: '$scopesList' },
          scopes: {
            $map: {
              input: { $slice: ['$scopesList', 10] },
              as: 'scope',
              in: {
                assetIdentifier: '$$scope.target',
                assetType: '$$scope.type',
                status: '$$scope.status',
              },
            },
          },
        },
      },
      {
        $project: {
          scopesList: 0,
        },
      },
    ]).exec();

    return {
      data: programs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<ProgramDocument> {
    const program = await this.programModel.findById(id).exec();
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    return program;
  }

  async update(id: string, updateProgramDto: UpdateProgramDto): Promise<ProgramDocument> {
    const program = await this.programModel
      .findByIdAndUpdate(id, updateProgramDto, { new: true })
      .exec();
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    return program;
  }

  async delete(id: string): Promise<void> {
    const result = await this.programModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Program not found');
    }
    await this.domainModel.deleteMany({ programId: new Types.ObjectId(id) }).exec();
  }

  async getStats(id: string): Promise<any> {
    const program = await this.findById(id);
    const programObjectId = new Types.ObjectId(id);

    const [domainCount, vulnStats] = await Promise.all([
      this.domainModel.countDocuments({ programId: programObjectId }),
      this.vulnModel.aggregate([
        { $match: { programId: programObjectId } },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const vulnBySeverity = vulnStats.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    );

    return {
      program,
      domainCount,
      vulnerabilities: vulnBySeverity,
      totalVulnerabilities: Object.values(vulnBySeverity).reduce((a: number, b: number) => a + b, 0),
    };
  }

  async getDomains(id: string): Promise<DomainDocument[]> {
    await this.findById(id);
    return this.domainModel.find({ programId: new Types.ObjectId(id) }).exec();
  }

  async getVulnerabilities(id: string): Promise<VulnerabilityDocument[]> {
    await this.findById(id);
    return this.vulnModel
      .find({ programId: new Types.ObjectId(id) })
      .sort({ severity: 1, createdAt: -1 })
      .exec();
  }

  async getScopes(id: string): Promise<ScopeDocument[]> {
    await this.findById(id);
    return this.scopeModel
      .find({ programId: new Types.ObjectId(id) })
      .sort({ status: 1, target: 1 })
      .exec();
  }

  async updateCounts(id: string): Promise<void> {
    const programObjectId = new Types.ObjectId(id);
    const [domainCount, vulnCount] = await Promise.all([
      this.domainModel.countDocuments({ programId: programObjectId }),
      this.vulnModel.countDocuments({ programId: programObjectId }),
    ]);

    await this.programModel.findByIdAndUpdate(id, {
      domainCount,
      vulnerabilityCount: vulnCount,
    });
  }
}
