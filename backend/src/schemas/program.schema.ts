import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgramDocument = Program & Document;

@Schema({ timestamps: true })
export class Program {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ enum: ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'custom', 'other'], default: 'custom' })
  platform: string;

  @Prop()
  platformUrl: string;

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

  @Prop({ enum: ['active', 'paused', 'archived'], default: 'active' })
  status: string;

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
  vulnerabilityCount: number;
}

export const ProgramSchema = SchemaFactory.createForClass(Program);

ProgramSchema.index({ name: 1 });
ProgramSchema.index({ platform: 1 });
ProgramSchema.index({ status: 1 });
ProgramSchema.index({ createdBy: 1 });

