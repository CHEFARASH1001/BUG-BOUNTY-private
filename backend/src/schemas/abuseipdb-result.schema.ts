import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AbuseIPDBResultDocument = AbuseIPDBResult & Document;

@Schema({ timestamps: true })
export class AbuseIPDBResult {
  @Prop({ required: true })
  ipAddress: string;

  @Prop({ default: 0 })
  abuseConfidenceScore: number;

  @Prop()
  countryCode: string;

  @Prop()
  isp: string;

  @Prop()
  domain: string;

  @Prop({ default: 0 })
  totalReports: number;

  @Prop()
  lastReportedAt: Date;

  @Prop({ default: false })
  isWhitelisted: boolean;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Subdomain' })
  subdomainId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Domain' })
  domainId?: Types.ObjectId;

  @Prop()
  checkedAt: Date;
}

export const AbuseIPDBResultSchema = SchemaFactory.createForClass(AbuseIPDBResult);

AbuseIPDBResultSchema.index({ ipAddress: 1 });
AbuseIPDBResultSchema.index({ subdomainId: 1 });
AbuseIPDBResultSchema.index({ domainId: 1 });
