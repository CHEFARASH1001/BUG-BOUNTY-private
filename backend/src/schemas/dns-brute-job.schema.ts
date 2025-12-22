import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DNSBruteJobDocument = DNSBruteJob & Document;

export enum DNSBruteMode {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

export enum DNSBruteJobStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface WordlistSources {
  bestDns: boolean;
  twoMillionSubdomains: boolean;
  crunch: boolean;
  custom?: string[];
}

export interface CrunchConfig {
  minLength: number;
  maxLength: number;
  charset: string;
}

export interface WordlistConfig {
  sources: WordlistSources;
  crunchConfig?: CrunchConfig;
}

@Schema({ timestamps: true })
export class DNSBruteJob {
  @Prop({ required: true })
  domain: string;

  @Prop({ enum: DNSBruteMode, required: true })
  mode: string;

  @Prop({ type: Object })
  wordlistConfig: WordlistConfig;

  @Prop({ default: 200 })
  threads: number;

  @Prop({ enum: DNSBruteJobStatus, default: DNSBruteJobStatus.PENDING })
  status: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ default: 0 })
  discoveredCount: number;

  @Prop({ type: [String], default: [] })
  results: string[];

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  error: string;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

export const DNSBruteJobSchema = SchemaFactory.createForClass(DNSBruteJob);

DNSBruteJobSchema.index({ status: 1 });
DNSBruteJobSchema.index({ programId: 1 });
DNSBruteJobSchema.index({ userId: 1 });
