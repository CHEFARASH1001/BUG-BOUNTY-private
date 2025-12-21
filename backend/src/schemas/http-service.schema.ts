import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HttpServiceDocument = HttpService & Document;

@Schema({ timestamps: true, collection: 'http_services' })
export class HttpService {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ required: true, lowercase: true, trim: true })
  subdomain: string;

  @Prop({ required: true, lowercase: true, trim: true })
  domain: string;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Live' })
  liveId: Types.ObjectId;

  @Prop()
  statusCode: number;

  @Prop()
  title: string;

  @Prop()
  contentLength: number;

  @Prop()
  contentType: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ type: Object, default: {} })
  headers: Record<string, string>;

  @Prop()
  webServer: string;

  @Prop()
  faviconHash: string;

  @Prop()
  faviconUrl: string;

  @Prop({ default: false })
  isCdn: boolean;

  @Prop({ type: [String], default: [] })
  cdnProvider: string[];

  @Prop({ type: [String], default: [] })
  waf: string[];

  @Prop({ type: [String], default: [] })
  redirectChain: string[];

  @Prop()
  finalUrl: string;

  @Prop({ type: Object })
  ssl: {
    issuer?: string;
    subject?: string;
    validFrom?: Date;
    validTo?: Date;
    isExpired?: boolean;
    isValid?: boolean;
    fingerprint?: string;
  };

  @Prop({ type: [String], default: [] })
  extractedFqdn: string[];

  @Prop()
  responseTime: number;

  @Prop()
  body: string;

  @Prop()
  bodyHash: string;

  @Prop()
  screenshot: string;

  @Prop()
  provider: string; // Source of probe (httpx, etc.)

  @Prop({ default: false })
  isFresh: boolean;

  @Prop()
  scannedAt: Date;

  @Prop()
  firstSeen: Date;

  @Prop()
  lastSeen: Date;

  // Previous scan data for comparison
  @Prop({ type: Object })
  previousScan: {
    statusCode?: number;
    title?: string;
    technologies?: string[];
    contentLength?: number;
    bodyHash?: string;
    scannedAt?: Date;
  };

  // Change tracking
  @Prop({ default: false })
  statusCodeChanged: boolean;

  @Prop({ default: false })
  titleChanged: boolean;

  @Prop({ default: false })
  techChanged: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  notes: string;
}

export const HttpServiceSchema = SchemaFactory.createForClass(HttpService);

HttpServiceSchema.index({ url: 1 }, { unique: true });
HttpServiceSchema.index({ subdomain: 1 });
HttpServiceSchema.index({ domain: 1 });
HttpServiceSchema.index({ programId: 1 });
HttpServiceSchema.index({ statusCode: 1 });
HttpServiceSchema.index({ technologies: 1 });
HttpServiceSchema.index({ isFresh: 1 });
HttpServiceSchema.index({ isCdn: 1 });
HttpServiceSchema.index({ provider: 1 });
HttpServiceSchema.index({ scannedAt: -1 });
HttpServiceSchema.index({ createdAt: -1 });
HttpServiceSchema.index({ faviconHash: 1 });
HttpServiceSchema.index({ statusCodeChanged: 1 });
HttpServiceSchema.index({ titleChanged: 1 });
HttpServiceSchema.index({ techChanged: 1 });

