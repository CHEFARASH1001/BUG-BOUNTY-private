import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DomainDocument = Domain & Document;

@Schema({ timestamps: true })
export class Domain {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  domain: string;

  @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
  programId: Types.ObjectId;

  @Prop({ enum: ['pending', 'scanning', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop()
  lastScan: Date;

  @Prop({ type: Object, default: {} })
  dnsRecords: {
    a?: string[];
    aaaa?: string[];
    cname?: string[];
    mx?: { priority: number; exchange: string }[];
    txt?: string[];
    ns?: string[];
    soa?: object;
  };

  @Prop({ type: Object, default: {} })
  whois: {
    registrar?: string;
    creationDate?: Date;
    expirationDate?: Date;
    nameServers?: string[];
    registrant?: object;
  };

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ type: Object, default: {} })
  ssl: {
    issuer?: string;
    validFrom?: Date;
    validTo?: Date;
    protocol?: string;
    cipher?: string;
    isExpired?: boolean;
    isValid?: boolean;
    grade?: string;
  };

  @Prop({ default: 0 })
  subdomainCount: number;

  @Prop({ default: 0 })
  vulnerabilityCount: number;

  @Prop({ default: 0 })
  endpointCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  metadata: {
    ipAddresses?: string[];
    asn?: string;
    org?: string;
    isp?: string;
    country?: string;
    city?: string;
  };

  @Prop({ type: [String], default: [] })
  waf: string[]; // Detected WAF/CDN

  @Prop()
  notes: string;
}

export const DomainSchema = SchemaFactory.createForClass(Domain);

DomainSchema.index({ domain: 1 });
DomainSchema.index({ programId: 1 });
DomainSchema.index({ status: 1 });
DomainSchema.index({ lastScan: -1 });

