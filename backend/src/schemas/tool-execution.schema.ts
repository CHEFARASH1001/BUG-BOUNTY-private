import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ToolExecutionDocument = ToolExecution & Document;

/**
 * Execution status enum
 * Requirements: 4.2, 4.3
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class ToolExecution {
  @Prop({ type: Types.ObjectId, ref: 'Tool', required: true })
  tool: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  arguments: string[];

  @Prop({ type: Object, default: {} })
  config: Record<string, any>;

  @Prop({ 
    type: String, 
    enum: Object.values(ExecutionStatus), 
    default: ExecutionStatus.PENDING 
  })
  status: ExecutionStatus;

  @Prop({ default: '' })
  stdout: string;

  @Prop({ default: '' })
  stderr: string;

  @Prop()
  exitCode: number;

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  duration: number; // milliseconds

  @Prop()
  errorMessage: string;
}

export const ToolExecutionSchema = SchemaFactory.createForClass(ToolExecution);

// Indexes for efficient querying
ToolExecutionSchema.index({ tool: 1 });
ToolExecutionSchema.index({ status: 1 });
ToolExecutionSchema.index({ startedAt: -1 });
ToolExecutionSchema.index({ tool: 1, startedAt: -1 });
