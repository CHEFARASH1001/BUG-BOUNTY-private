import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubdomainDocument = Subdomain & Document;

@Schema({ timestamps: true })
export class Subdomain {
  @Prop({ required: true, lowercase: true, trim: true })
  subdomain: string;

  @Prop({ type: Types.ObjectId, ref: 'Domain', required: true })
  domainId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  ip: string[];

  @Prop({ default: false })
  isAlive: boolean;

  @Prop()
  httpStatus: number;

  @Prop()
  httpsStatus: number;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ type: [Object], default: [] })
  ports: {
    port: number;
    protocol: string;
    service: string;
    version?: string;
    banner?: string;
  }[];

  @Prop()
  title: string;

  @Prop()
  contentLength: number;

  @Prop()
  contentType: string;

  @Prop({ type: [String], default: [] })
  cdn: string[];

  @Prop({ type: [String], default: [] })
  waf: string[];

  @Prop({ type: Object, default: {} })
  ssl: {
    issuer?: string;
    validFrom?: Date;
    validTo?: Date;
    isExpired?: boolean;
    isValid?: boolean;
  };

  @Prop({ type: [String], default: [] })
  cname: string[];

  @Prop({ type: [String], default: [] })
  sources: string[]; // Where this subdomain was discovered

  @Prop()
  screenshot: string; // Path to screenshot

  @Prop()
  favicon: string;

  @Prop()
  faviconHash: string;

  @Prop({ type: Object, default: {} })
  headers: Record<string, string>;

  @Prop({ type: [String], default: [] })
  cookies: string[];

  @Prop()
  webServer: string;

  @Prop({ default: 0 })
  vulnerabilityCount: number;

  @Prop({ default: 0 })
  endpointCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  notes: string;

  @Prop({ default: false })
  isNew: boolean; // Flag for newly discovered subdomains

  @Prop()
  firstSeen: Date;

  @Prop()
  lastSeen: Date;
}

export const SubdomainSchema = SchemaFactory.createForClass(Subdomain);

SubdomainSchema.index({ subdomain: 1 }, { unique: true });
SubdomainSchema.index({ domainId: 1 });
SubdomainSchema.index({ isAlive: 1 });
SubdomainSchema.index({ httpStatus: 1 });
SubdomainSchema.index({ technologies: 1 });
SubdomainSchema.index({ isNew: 1 });
SubdomainSchema.index({ createdAt: -1 });

