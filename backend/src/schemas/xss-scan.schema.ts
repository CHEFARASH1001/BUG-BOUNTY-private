import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type XssScanDocument = XssScan & Document;

export interface XssResult {
  url: string;
  parameter: string;
  payload: string;
  type: 'reflected' | 'stored' | 'dom';
  context: 'html' | 'attribute' | 'script' | 'url' | 'style';
  evidence?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  wafBypassed?: boolean;
  tool: string;
}

export interface ScanLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

@Schema({ timestamps: true })
export class XssScan {
  @Prop({ required: true })
  url: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  })
  status: string;

  @Prop({ type: Object })
  config: {
    tools: string[];
    customPayloads?: string[];
    crawl?: boolean;
    depth?: number;
    threads?: number;
    timeout?: number;
    wafBypass?: boolean;
    blindXss?: string;
    headers?: Record<string, string>;
    cookies?: string;
  };

  @Prop({ type: [Object], default: [] })
  results: XssResult[];

  @Prop({ type: [Object], default: [] })
  logs: ScanLog[];

  @Prop()
  error?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ default: 0 })
  urlsScanned: number;

  @Prop({ default: 0 })
  totalUrls: number;

  @Prop({ default: 0 })
  vulnerabilitiesFound: number;

  @Prop()
  currentPhase?: string;
}

export const XssScanSchema = SchemaFactory.createForClass(XssScan);
