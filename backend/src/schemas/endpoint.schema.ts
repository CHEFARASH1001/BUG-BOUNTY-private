import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EndpointDocument = Endpoint & Document;

@Schema({ timestamps: true })
export class Endpoint {
  @Prop({ required: true })
  url: string;

  @Prop({ type: Types.ObjectId, ref: 'Subdomain', required: true })
  subdomainId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Domain' })
  domainId: Types.ObjectId;

  @Prop({ default: 'GET' })
  method: string;

  @Prop()
  statusCode: number;

  @Prop()
  contentType: string;

  @Prop()
  contentLength: number;

  @Prop({ type: [Object], default: [] })
  parameters: {
    name: string;
    type: string; // query, body, path, header
    value?: string;
    isRequired?: boolean;
  }[];

  @Prop()
  path: string;

  @Prop({ type: [String], default: [] })
  sources: string[]; // wayback, javascript, crawl, etc.

  @Prop({ type: Object, default: {} })
  headers: Record<string, string>;

  @Prop()
  title: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  isInteresting: boolean; // Contains params, admin paths, etc.

  @Prop({ type: [String], default: [] })
  interestingPatterns: string[]; // Matched patterns

  @Prop({ default: false })
  hasParams: boolean;

  @Prop({ default: false })
  hasAuth: boolean;

  @Prop()
  notes: string;

  @Prop({ default: false })
  isNew: boolean;

  @Prop()
  firstSeen: Date;

  @Prop()
  lastSeen: Date;

  @Prop()
  responseHash: string; // For detecting changes
}

export const EndpointSchema = SchemaFactory.createForClass(Endpoint);

EndpointSchema.index({ url: 1 });
EndpointSchema.index({ subdomainId: 1 });
EndpointSchema.index({ domainId: 1 });
EndpointSchema.index({ method: 1 });
EndpointSchema.index({ statusCode: 1 });
EndpointSchema.index({ isInteresting: 1 });
EndpointSchema.index({ hasParams: 1 });
EndpointSchema.index({ createdAt: -1 });

