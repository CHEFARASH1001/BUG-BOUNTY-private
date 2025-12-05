import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScanDocument = Scan & Document;

export enum ScanType {
  FULL = 'full',
  SUBDOMAIN = 'subdomain',
  PORT = 'port',
  NUCLEI = 'nuclei',
  TECHNOLOGY = 'technology',
  SCREENSHOT = 'screenshot',
  ENDPOINT = 'endpoint',
  DNS = 'dns',
  SSL = 'ssl',
  WAF = 'waf',
  CUSTOM = 'custom',
}

export enum ScanStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

@Schema({ timestamps: true })
export class Scan {
  @Prop({ required: true, enum: ScanType })
  type: string;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, enum: ['domain', 'subdomain', 'program'] })
  targetType: string;

  @Prop({ required: true })
  target: string; // Human readable target (domain name, etc)

  @Prop({ required: true, enum: ScanStatus, default: ScanStatus.QUEUED })
  status: string;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop()
  currentStep: string;

  @Prop({ type: Object, default: {} })
  results: {
    subdomainsFound?: number;
    portsFound?: number;
    vulnerabilitiesFound?: number;
    endpointsFound?: number;
    technologiesFound?: string[];
    screenshotsTaken?: number;
    [key: string]: unknown;
  };

  @Prop({ type: Object, default: {} })
  config: {
    templates?: string[];
    ports?: string;
    threads?: number;
    timeout?: number;
    rateLimit?: number;
    [key: string]: unknown;
  };

  @Prop()
  error: string;

  @Prop({ type: [String], default: [] })
  logs: string[];

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  duration: number; // in seconds

  @Prop({ type: Types.ObjectId, ref: 'User' })
  initiatedBy: Types.ObjectId;

  @Prop()
  jobId: string; // Bull queue job ID

  @Prop({ default: 1 })
  priority: number;

  @Prop({ default: false })
  isScheduled: boolean;

  @Prop()
  scheduleCron: string;
}

export const ScanSchema = SchemaFactory.createForClass(Scan);

ScanSchema.index({ targetId: 1 });
ScanSchema.index({ targetType: 1 });
ScanSchema.index({ type: 1 });
ScanSchema.index({ status: 1 });
ScanSchema.index({ createdAt: -1 });
ScanSchema.index({ startedAt: -1 });

