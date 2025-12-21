import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LiveDocument = Live & Document;

@Schema({ timestamps: true, collection: 'lives' })
export class Live {
  @Prop({ required: true, lowercase: true, trim: true })
  subdomain: string;

  @Prop({ required: true, lowercase: true, trim: true })
  domain: string;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  ip: string[];

  @Prop({ type: [String], default: [] })
  cname: string[];

  @Prop({ default: false })
  isCdn: boolean;

  @Prop({ type: [String], default: [] })
  cdnProvider: string[];

  @Prop()
  provider: string; // Source of discovery (dnsx, shuffledns, etc.)

  @Prop({ default: false })
  isFresh: boolean;

  @Prop({ default: false })
  isWildcard: boolean;

  @Prop()
  resolvedAt: Date;

  @Prop()
  firstSeen: Date;

  @Prop()
  lastSeen: Date;

  @Prop({ type: Object, default: {} })
  dnsRecords: {
    a?: string[];
    aaaa?: string[];
    cname?: string[];
    mx?: string[];
    ns?: string[];
    txt?: string[];
    soa?: string;
  };

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  notes: string;
}

export const LiveSchema = SchemaFactory.createForClass(Live);

LiveSchema.index({ subdomain: 1 }, { unique: true });
LiveSchema.index({ domain: 1 });
LiveSchema.index({ programId: 1 });
LiveSchema.index({ isFresh: 1 });
LiveSchema.index({ isCdn: 1 });
LiveSchema.index({ provider: 1 });
LiveSchema.index({ resolvedAt: -1 });
LiveSchema.index({ createdAt: -1 });
LiveSchema.index({ ip: 1 });

