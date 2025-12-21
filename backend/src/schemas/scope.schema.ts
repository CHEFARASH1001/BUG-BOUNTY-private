import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScopeDocument = Scope & Document;

export enum ScopeType {
  DOMAIN = 'domain',
  WILDCARD = 'wildcard',
  IP = 'ip',
  IP_RANGE = 'ip_range',
  URL = 'url',
  MOBILE_APP = 'mobile_app',
  API = 'api',
  OTHER = 'other',
}

export enum ScopeStatus {
  IN_SCOPE = 'in_scope',
  OUT_OF_SCOPE = 'out_of_scope',
}

@Schema({ timestamps: true, collection: 'scopes' })
export class Scope {
  @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
  programId: Types.ObjectId;

  @Prop({ required: true })
  target: string;

  @Prop({ required: true, enum: ScopeType })
  type: ScopeType;

  @Prop({ required: true, enum: ScopeStatus })
  status: ScopeStatus;

  @Prop()
  description: string;

  @Prop({ default: 0 })
  maxSeverity: number; // Maximum severity allowed for this scope

  @Prop({ default: false })
  isVulnDisclosureOnly: boolean;

  @Prop({ default: true })
  isActive: boolean;

  // Eligibility
  @Prop({ type: Object, default: {} })
  eligibility: {
    minBounty?: number;
    maxBounty?: number;
    currency?: string;
    isEligible?: boolean;
  };

  // Asset information
  @Prop({ type: Object, default: {} })
  assetInfo: {
    instruction?: string;
    impactLevel?: string;
    assetIdentifier?: string;
  };

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  notes: string;

  // Stats
  @Prop({ default: 0 })
  subdomainCount: number;

  @Prop({ default: 0 })
  liveCount: number;

  @Prop({ default: 0 })
  httpServiceCount: number;

  @Prop({ default: 0 })
  vulnerabilityCount: number;

  @Prop()
  lastScannedAt: Date;

  @Prop()
  firstSeenAt: Date;
}

export const ScopeSchema = SchemaFactory.createForClass(Scope);

ScopeSchema.index({ programId: 1, target: 1 }, { unique: true });
ScopeSchema.index({ programId: 1 });
ScopeSchema.index({ target: 1 });
ScopeSchema.index({ type: 1 });
ScopeSchema.index({ status: 1 });
ScopeSchema.index({ isActive: 1 });
ScopeSchema.index({ createdAt: -1 });

