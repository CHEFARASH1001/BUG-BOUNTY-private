import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scan, ScanDocument, ScanType, ScanStatus } from '../../schemas/scan.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { QueueService } from '../queue/queue.service';
import { QueueConstants } from '../queue/queue.constants';
import { CreateScanDto } from './dto/scan.dto';

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(Scan.name) private scanModel: Model<ScanDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    private queueService: QueueService,
  ) {}

  async create(createScanDto: CreateScanDto, userId?: string): Promise<ScanDocument> {
    const scan = await this.scanModel.create({
      ...createScanDto,
      targetId: new Types.ObjectId(createScanDto.targetId),
      initiatedBy: userId ? new Types.ObjectId(userId) : undefined,
      status: ScanStatus.QUEUED,
    });

    // Publish scan job to RabbitMQ based on type
    const jobData = {
        scanId: scan._id.toString(),
        targetId: createScanDto.targetId,
        target: createScanDto.target,
        type: createScanDto.type,
        config: createScanDto.config,
    };

    await this.publishScanJob(createScanDto.type, jobData);

    return scan;
  }

  private async publishScanJob(type: string, jobData: any): Promise<void> {
    switch (type) {
      case ScanType.FULL:
        await this.queueService.publishFullScan(jobData);
        break;
      case ScanType.SUBDOMAIN:
        await this.queueService.publishSubdomainScan(jobData);
        break;
      case ScanType.PORT:
        await this.queueService.publishPortScan(jobData);
        break;
      case ScanType.NUCLEI:
        await this.queueService.publishNucleiScan(jobData);
        break;
      case ScanType.DNS:
        await this.queueService.publishDnsScan(jobData);
        break;
      default:
        // For other scan types, use the generic scan queue
        await this.queueService.publishScanJob(
          this.getRoutingKey(type),
          jobData,
        );
    }
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

    // Note: With RabbitMQ, we cannot directly cancel a queued job
    // We just mark it as cancelled and the processor should check the status
    return this.updateStatus(id, ScanStatus.CANCELLED);
  }

  async retry(id: string): Promise<ScanDocument> {
    const scan = await this.findById(id);

    if (scan.status !== ScanStatus.FAILED && scan.status !== ScanStatus.CANCELLED) {
      throw new Error('Can only retry failed or cancelled scans');
    }

    // Reset scan status and publish new job
    await this.scanModel.findByIdAndUpdate(id, {
      status: ScanStatus.QUEUED,
      progress: 0,
      error: null,
      logs: [],
      startedAt: null,
      completedAt: null,
      duration: null,
    });

    const jobData = {
        scanId: id,
        targetId: scan.targetId.toString(),
        target: scan.target,
        type: scan.type,
        config: scan.config,
    };

    await this.publishScanJob(scan.type, jobData);

    return this.scanModel.findById(id).exec() as Promise<ScanDocument>;
  }

  async getQueueStats(): Promise<any> {
    // With RabbitMQ, we track stats in the database
    const [queued, running, completed, failed] = await Promise.all([
      this.scanModel.countDocuments({ status: ScanStatus.QUEUED }),
      this.scanModel.countDocuments({ status: ScanStatus.RUNNING }),
      this.scanModel.countDocuments({ status: ScanStatus.COMPLETED }),
      this.scanModel.countDocuments({ status: ScanStatus.FAILED }),
    ]);

    return { waiting: queued, active: running, completed, failed };
  }

  async getRecentScans(limit = 10): Promise<ScanDocument[]> {
    return this.scanModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async getRunningScans(): Promise<ScanDocument[]> {
    return this.scanModel.find({ status: ScanStatus.RUNNING }).exec();
  }

  private getRoutingKey(type: string): string {
    const routingKeys: Record<string, string> = {
      [ScanType.FULL]: QueueConstants.ROUTING_FULL_SCAN,
      [ScanType.SUBDOMAIN]: QueueConstants.ROUTING_SUBDOMAIN_SCAN,
      [ScanType.PORT]: QueueConstants.ROUTING_PORT_SCAN,
      [ScanType.NUCLEI]: QueueConstants.ROUTING_NUCLEI_SCAN,
      [ScanType.DNS]: QueueConstants.ROUTING_DNS_SCAN,
      [ScanType.TECHNOLOGY]: 'scan.technology',
      [ScanType.SCREENSHOT]: 'scan.screenshot',
      [ScanType.ENDPOINT]: 'scan.endpoint',
      [ScanType.SSL]: 'scan.ssl',
      [ScanType.WAF]: 'scan.waf',
    };
    return routingKeys[type] || 'scan.custom';
  }
}
