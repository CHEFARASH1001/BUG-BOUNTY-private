import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgramDocument = Program & Document;

@Schema({ timestamps: true })
export class Program {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, lowercase: true })
  handle: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ enum: ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'custom', 'github', 'other'], default: 'custom' })
  platform: string;

  @Prop()
  url: string;

  @Prop()
  platformUrl: string;

  @Prop()
  state: string;

  @Prop({ default: false })
  offersBounties: boolean;

  @Prop({ type: [String], default: [] })
  scope: string[];

  @Prop({ type: [String], default: [] })
  outOfScope: string[];

  @Prop({ type: Object, default: {} })
  rewards: {
    critical?: string;
    high?: string;
    medium?: string;
    low?: string;
  };

  @Prop({ type: Object })
  bountyRange: {
    min?: number;
    max?: number;
    currency?: string;
  };

  @Prop({ enum: ['active', 'paused', 'archived', 'open', 'closed'], default: 'active' })
  status: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  settings: {
    autoScan?: boolean;
    scanFrequency?: string; // 'daily', 'weekly', 'monthly'
    notifyOnNew?: boolean;
    maxConcurrentScans?: number;
  };

  @Prop({ default: 0 })
  domainCount: number;

  @Prop({ default: 0 })
  subdomainCount: number;

  @Prop({ default: 0 })
  liveCount: number;

  @Prop({ default: 0 })
  httpServiceCount: number;

  @Prop({ default: 0 })
  vulnerabilityCount: number;

  @Prop()
  firstSyncedAt: Date;

  @Prop()
  lastSyncedAt: Date;

  @Prop()
  lastScannedAt: Date;

  @Prop()
  notes: string;

  // Enriched data fields for platform data enrichment feature

  // Bounty table with severity-based min/max structure (Requirements: 1.1, 1.2, 1.3)
  @Prop({ type: Object })
  bountyTable: {
    critical?: { min?: number; max?: number };
    high?: { min?: number; max?: number };
    medium?: { min?: number; max?: number };
    low?: { min?: number; max?: number };
  };

  // Response metrics for response time data (Requirements: 2.1, 2.2, 2.3)
  @Prop({ type: Object })
  responseMetrics: {
    averageTimeToFirstResponse?: number;  // in days
    averageTimeToBounty?: number;         // in days
    averageTimeToResolution?: number;     // in days
  };

  // Activity statistics for program activity data (Requirements: 3.1, 3.2, 3.3)
  @Prop({ type: Object })
  activityStats: {
    resolvedReportCount?: number;
    totalBountiesPaid?: number;
    hackersThanked?: number;
  };

  // Scope statistics for scope information (Requirements: 4.1, 4.2, 4.3)
  @Prop({ type: Object })
  scopeStats: {
    totalAssets?: number;
    wildcardCount?: number;
    domainCount?: number;
    apiCount?: number;
    mobileAppCount?: number;
    bountyEligibleCount?: number;
  };

  // Program launch date (Requirements: 3.4)
  @Prop()
  launchedAt: Date;
}

export const ProgramSchema = SchemaFactory.createForClass(Program);

ProgramSchema.index({ name: 1 });
ProgramSchema.index({ handle: 1 });
ProgramSchema.index({ platform: 1 });
ProgramSchema.index({ platform: 1, handle: 1 }, { unique: true, sparse: true });
ProgramSchema.index({ status: 1 });
ProgramSchema.index({ isActive: 1 });
ProgramSchema.index({ offersBounties: 1 });
ProgramSchema.index({ createdBy: 1 });
ProgramSchema.index({ lastSyncedAt: -1 });
