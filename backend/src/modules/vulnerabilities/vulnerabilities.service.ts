import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vulnerability, VulnerabilityDocument, VulnStatus, Severity } from '../../schemas/vulnerability.schema';
import { CreateVulnerabilityDto, UpdateVulnerabilityDto } from './dto/vulnerability.dto';

@Injectable()
export class VulnerabilitiesService {
  constructor(
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
  ) {}

  async create(createVulnDto: CreateVulnerabilityDto): Promise<VulnerabilityDocument> {
    // Generate hash for deduplication
    const hash = this.generateHash(createVulnDto);

    // Check for existing vulnerability
    const existing = await this.vulnModel.findOne({ hash });
    if (existing) {
      // Update existing instead of creating duplicate
      return this.vulnModel.findByIdAndUpdate(
        existing._id,
        { $set: { ...createVulnDto, isNew: false } },
        { new: true },
      ).exec() as Promise<VulnerabilityDocument>;
    }

    return this.vulnModel.create({
      ...createVulnDto,
      targetId: createVulnDto.targetId ? new Types.ObjectId(createVulnDto.targetId) : undefined,
      programId: createVulnDto.programId ? new Types.ObjectId(createVulnDto.programId) : undefined,
      hash,
      isNew: true,
    });
  }

  async findAll(filters?: {
    severity?: string;
    status?: string;
    type?: string;
    programId?: string;
    targetId?: string;
    isNew?: boolean;
    sourceTool?: string;
    search?: string;
  }): Promise<VulnerabilityDocument[]> {
    const query: any = {};

    if (filters?.severity) {
      query.severity = filters.severity;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.programId) {
      query.programId = new Types.ObjectId(filters.programId);
    }
    if (filters?.targetId) {
      query.targetId = new Types.ObjectId(filters.targetId);
    }
    if (filters?.isNew !== undefined) {
      query.isNew = filters.isNew;
    }
    if (filters?.sourceTool) {
      query.sourceTool = filters.sourceTool;
    }
    if (filters?.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { target: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return this.vulnModel
      .find(query)
      .sort({ severity: 1, createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<VulnerabilityDocument> {
    const vuln = await this.vulnModel.findById(id).exec();
    if (!vuln) {
      throw new NotFoundException('Vulnerability not found');
    }
    return vuln;
  }

  async update(id: string, updateVulnDto: UpdateVulnerabilityDto): Promise<VulnerabilityDocument> {
    const vuln = await this.vulnModel
      .findByIdAndUpdate(id, { $set: updateVulnDto }, { new: true })
      .exec();
    if (!vuln) {
      throw new NotFoundException('Vulnerability not found');
    }
    return vuln;
  }

  async updateStatus(id: string, status: VulnStatus): Promise<VulnerabilityDocument> {
    const vuln = await this.vulnModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
    if (!vuln) {
      throw new NotFoundException('Vulnerability not found');
    }
    return vuln;
  }

  async delete(id: string): Promise<void> {
    const result = await this.vulnModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Vulnerability not found');
    }
  }

  async getStats(programId?: string): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byType: { type: string; count: number }[];
    newCount: number;
  }> {
    const matchStage: any = {};
    if (programId) {
      matchStage.programId = new Types.ObjectId(programId);
    }

    const [severityStats, statusStats, typeStats, total, newCount] = await Promise.all([
      this.vulnModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      this.vulnModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.vulnModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      this.vulnModel.countDocuments(matchStage),
      this.vulnModel.countDocuments({ ...matchStage, isNew: true }),
    ]);

    return {
      total,
      bySeverity: this.arrayToRecord(severityStats),
      byStatus: this.arrayToRecord(statusStats),
      byType: typeStats.map((t) => ({ type: t._id || 'unknown', count: t.count })),
      newCount,
    };
  }

  async markAsViewed(ids: string[]): Promise<void> {
    await this.vulnModel.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { $set: { isNew: false } },
    );
  }

  async bulkUpdateStatus(ids: string[], status: VulnStatus): Promise<void> {
    await this.vulnModel.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { $set: { status } },
    );
  }

  async getDuplicates(): Promise<any[]> {
    return this.vulnModel.aggregate([
      {
        $group: {
          _id: { title: '$title', target: '$target' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  private generateHash(vuln: CreateVulnerabilityDto): string {
    const data = `${vuln.title}-${vuln.target}-${vuln.type || ''}`;
    return Buffer.from(data).toString('base64').replace(/[=+/]/g, '');
  }

  private arrayToRecord(arr: { _id: string; count: number }[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of arr) {
      result[item._id || 'unknown'] = item.count;
    }
    return result;
  }

  /**
   * Get list of unique source tools used in vulnerabilities
   * @returns Array of source tool names
   */
  async getSourceTools(): Promise<string[]> {
    const result = await this.vulnModel.distinct('sourceTool', { sourceTool: { $ne: null } });
    return result.filter((tool): tool is string => typeof tool === 'string' && tool.length > 0);
  }
}

