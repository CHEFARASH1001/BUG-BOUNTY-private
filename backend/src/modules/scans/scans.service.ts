import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model, Types } from 'mongoose';
import { Queue } from 'bull';
import { Scan, ScanDocument, ScanType, ScanStatus } from '../../schemas/scan.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { CreateScanDto } from './dto/scan.dto';

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(Scan.name) private scanModel: Model<ScanDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectQueue('scans') private scansQueue: Queue,
  ) {}

  async create(createScanDto: CreateScanDto, userId?: string): Promise<ScanDocument> {
    const scan = await this.scanModel.create({
      ...createScanDto,
      targetId: new Types.ObjectId(createScanDto.targetId),
      initiatedBy: userId ? new Types.ObjectId(userId) : undefined,
      status: ScanStatus.QUEUED,
    });

    // Queue the scan job based on type
    const jobName = this.getJobName(createScanDto.type);
    const job = await this.scansQueue.add(
      jobName,
      {
        scanId: scan._id.toString(),
        targetId: createScanDto.targetId,
        target: createScanDto.target,
        type: createScanDto.type,
        config: createScanDto.config,
      },
      {
        priority: createScanDto.priority || 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    scan.jobId = job.id.toString();
    await scan.save();

    return scan;
  }

  async findAll(filters?: {
    targetId?: string;
    type?: string;
    status?: string;
    limit?: number;
  }): Promise<ScanDocument[]> {
    const query: any = {};

    if (filters?.targetId) {
      query.targetId = new Types.ObjectId(filters.targetId);
    }
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    let queryBuilder = this.scanModel.find(query).sort({ createdAt: -1 });

    if (filters?.limit) {
      queryBuilder = queryBuilder.limit(filters.limit);
    }

    return queryBuilder.exec();
  }

  async findById(id: string): Promise<ScanDocument> {
    const scan = await this.scanModel.findById(id).exec();
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
    return scan;
  }

  async updateStatus(
    id: string,
    status: ScanStatus,
    updates?: Partial<Scan>,
  ): Promise<ScanDocument> {
    const updateData: any = { status, ...updates };

    if (status === ScanStatus.RUNNING && !updates?.startedAt) {
      updateData.startedAt = new Date();
    }

    if (
      (status === ScanStatus.COMPLETED || status === ScanStatus.FAILED) &&
      !updates?.completedAt
    ) {
      updateData.completedAt = new Date();
    }

    const scan = await this.scanModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // Calculate duration if completed
    if (scan.startedAt && scan.completedAt) {
      scan.duration = Math.floor(
        (scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000,
      );
      await scan.save();
    }

    return scan;
  }

  async updateProgress(id: string, progress: number, currentStep?: string): Promise<void> {
    await this.scanModel.findByIdAndUpdate(id, {
      progress: Math.min(100, Math.max(0, progress)),
      currentStep,
    });
  }

  async addLog(id: string, log: string): Promise<void> {
    await this.scanModel.findByIdAndUpdate(id, {
      $push: { logs: `[${new Date().toISOString()}] ${log}` },
    });
  }

  async updateResults(id: string, results: Partial<Scan['results']>): Promise<void> {
    await this.scanModel.findByIdAndUpdate(id, {
      $set: { results },
    });
  }

  async cancel(id: string): Promise<ScanDocument> {
    const scan = await this.findById(id);

    if (scan.status === ScanStatus.COMPLETED || scan.status === ScanStatus.FAILED) {
      throw new Error('Cannot cancel a completed or failed scan');
    }

    // Remove from queue if still queued
    if (scan.jobId) {
      const job = await this.scansQueue.getJob(scan.jobId);
      if (job) {
        await job.remove();
      }
    }

    return this.updateStatus(id, ScanStatus.CANCELLED);
  }

  async retry(id: string): Promise<ScanDocument> {
    const scan = await this.findById(id);

    if (scan.status !== ScanStatus.FAILED && scan.status !== ScanStatus.CANCELLED) {
      throw new Error('Can only retry failed or cancelled scans');
    }

    // Reset scan status and queue new job
    await this.scanModel.findByIdAndUpdate(id, {
      status: ScanStatus.QUEUED,
      progress: 0,
      error: null,
      logs: [],
      startedAt: null,
      completedAt: null,
      duration: null,
    });

    const jobName = this.getJobName(scan.type);
    const job = await this.scansQueue.add(
      jobName,
      {
        scanId: id,
        targetId: scan.targetId.toString(),
        target: scan.target,
        type: scan.type,
        config: scan.config,
      },
      {
        priority: scan.priority,
        attempts: 3,
      },
    );

    return this.scanModel.findByIdAndUpdate(
      id,
      { jobId: job.id.toString() },
      { new: true },
    ).exec() as Promise<ScanDocument>;
  }

  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.scansQueue.getWaitingCount(),
      this.scansQueue.getActiveCount(),
      this.scansQueue.getCompletedCount(),
      this.scansQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async getRecentScans(limit = 10): Promise<ScanDocument[]> {
    return this.scanModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async getRunningScans(): Promise<ScanDocument[]> {
    return this.scanModel.find({ status: ScanStatus.RUNNING }).exec();
  }

  private getJobName(type: string): string {
    const jobNames: Record<string, string> = {
      [ScanType.FULL]: 'full-scan',
      [ScanType.SUBDOMAIN]: 'subdomain-scan',
      [ScanType.PORT]: 'port-scan',
      [ScanType.NUCLEI]: 'nuclei-scan',
      [ScanType.TECHNOLOGY]: 'technology-scan',
      [ScanType.SCREENSHOT]: 'screenshot-scan',
      [ScanType.ENDPOINT]: 'endpoint-scan',
      [ScanType.DNS]: 'dns-scan',
      [ScanType.SSL]: 'ssl-scan',
      [ScanType.WAF]: 'waf-scan',
    };
    return jobNames[type] || 'custom-scan';
  }
}

