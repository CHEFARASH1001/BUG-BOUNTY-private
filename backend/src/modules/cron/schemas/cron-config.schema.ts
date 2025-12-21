import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CronConfigDocument = CronConfig & Document;

@Schema({ timestamps: true, collection: 'cron_configs' })
export class CronConfig {
  @Prop({ required: true, unique: true })
  jobName: string;

  @Prop({ required: true })
  schedule: string; // cron expression

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  description: string;

  @Prop({ type: Object, default: {} })
  options: {
    timeout?: number;
    retries?: number;
    concurrency?: number;
  };

  @Prop()
  lastRunAt: Date;

  @Prop()
  nextRunAt: Date;

  @Prop({ default: 0 })
  runCount: number;

  @Prop({ default: 0 })
  failCount: number;
}

export const CronConfigSchema = SchemaFactory.createForClass(CronConfig);

