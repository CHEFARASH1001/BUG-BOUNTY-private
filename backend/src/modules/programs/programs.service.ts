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
  }): Promise<any[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.platform) {
      query.platform = filters.platform;
    }
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Use aggregation to include scope counts
    const programs = await this.programModel.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
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
              input: { $slice: ['$scopesList', 10] }, // Limit to first 10 for preview
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
          scopesList: 0, // Remove the full list to reduce payload
        },
      },
    ]).exec();

    return programs;
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
    // Also delete associated domains
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
    await this.findById(id); // Verify program exists
    return this.domainModel.find({ programId: new Types.ObjectId(id) }).exec();
  }

  async getVulnerabilities(id: string): Promise<VulnerabilityDocument[]> {
    await this.findById(id); // Verify program exists
    return this.vulnModel
      .find({ programId: new Types.ObjectId(id) })
      .sort({ severity: 1, createdAt: -1 })
      .exec();
  }

  async getScopes(id: string): Promise<ScopeDocument[]> {
    await this.findById(id); // Verify program exists
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

