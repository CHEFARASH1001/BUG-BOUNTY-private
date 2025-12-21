import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobExecutionDocument = JobExecution & Document;

export enum JobStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'job_executions' })
export class JobExecution {
  @Prop({ required: true })
  jobName: string;

  @Prop({ required: true, enum: JobStatus })
  status: JobStatus;

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  duration: number; // in milliseconds

  @Prop({ type: Object })
  result: Record<string, any>;

  @Prop()
  error: string;

  @Prop({ type: [String], default: [] })
  logs: string[];

  @Prop({ default: 'scheduled' })
  trigger: string; // 'scheduled', 'manual', 'api'
}

export const JobExecutionSchema = SchemaFactory.createForClass(JobExecution);

JobExecutionSchema.index({ jobName: 1, startedAt: -1 });
JobExecutionSchema.index({ status: 1 });
JobExecutionSchema.index({ createdAt: -1 });

