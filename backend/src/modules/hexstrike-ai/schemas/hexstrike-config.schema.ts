import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HexStrikeConfigDocument = HexStrikeConfig & Document;

/**
 * HexStrike AI Configuration Schema
 * Stores scan parameters (threads, timeout, rate limits) in MongoDB
 * Requirements: 8.3
 */
@Schema({ timestamps: true, collection: 'hexstrike_configs' })
export class HexStrikeConfig {
  @Prop({ required: true, unique: true, default: 'default' })
  configName: string;

  @Prop({ required: true, default: 10, min: 1, max: 100 })
  threads: number;

  @Prop({ required: true, default: 300, min: 30, max: 3600 })
  timeout: number;

  @Prop({ required: true, default: 10, min: 1, max: 1000 })
  rateLimit: number;

  @Prop({ required: true, default: 3, min: 1, max: 5 })
  scanDepth: number;

  @Prop({ required: true, default: '/app/results' })
  outputDir: string;

  @Prop()
  version?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const HexStrikeConfigSchema = SchemaFactory.createForClass(HexStrikeConfig);

// Index for efficient querying (configName already has unique index from @Prop)
HexStrikeConfigSchema.index({ isActive: 1 });
