import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FuzzJobDocument = FuzzJob & Document;

export enum FuzzJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface FuzzResult {
  url: string;
  status: number;
  length: number;
  words: number;
  lines: number;
  contentType: string;
  redirectLocation?: string;
}

export interface FuzzFilters {
  matchCodes?: number[];
  filterWords?: number;
  filterLines?: number;
  filterSize?: number;
}

@Schema({ timestamps: true })
export class FuzzJob {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  wordlist: string;

  @Prop({ type: [String], default: [] })
  extensions: string[];

  @Prop({ type: Object, default: {} })
  filters: FuzzFilters;

  @Prop({ enum: FuzzJobStatus, default: FuzzJobStatus.PENDING })
  status: string;

  @Prop({ type: [Object], default: [] })
  results: FuzzResult[];

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

export const FuzzJobSchema = SchemaFactory.createForClass(FuzzJob);

FuzzJobSchema.index({ status: 1 });
FuzzJobSchema.index({ programId: 1 });
FuzzJobSchema.index({ userId: 1 });
