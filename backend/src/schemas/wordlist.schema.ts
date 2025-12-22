import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WordlistDocument = Wordlist & Document;

export enum WordlistSource {
  ASSETNOTE = 'assetnote',
  CUSTOM = 'custom',
  GENERATED = 'generated',
  MERGED = 'merged',
}

@Schema({ timestamps: true })
export class Wordlist {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  path: string;

  @Prop()
  sourceUrl: string;

  @Prop({ default: 0 })
  lineCount: number;

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop()
  lastUpdated: Date;

  @Prop({ enum: WordlistSource })
  source: string;

  @Prop({ default: false })
  isReady: boolean;
}

export const WordlistSchema = SchemaFactory.createForClass(Wordlist);

WordlistSchema.index({ name: 1 }, { unique: true });
