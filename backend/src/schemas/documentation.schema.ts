import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentationDocument = Documentation & Document;

export enum DocType {
  NOTE = 'note',
  TECHNIQUE = 'technique',
  WRITEUP = 'writeup',
  REFERENCE = 'reference',
  CHECKLIST = 'checklist',
}

@Schema({ timestamps: true, collection: 'documentation' })
export class Documentation {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: DocType, default: DocType.NOTE })
  type: DocType;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  // Targets this documentation covers
  @Prop({ type: [String], default: [] })
  targets: string[];

  // Technologies this documentation relates to
  @Prop({ type: [String], default: [] })
  technologies: string[];

  // Vulnerability types covered
  @Prop({ type: [String], default: [] })
  vulnerabilityTypes: string[];

  // Coverage mapping - which programs/domains are covered
  @Prop({ type: [Object], default: [] })
  coverage: {
    targetId: Types.ObjectId;
    targetType: string;
    targetName: string;
    relevanceScore: number;
    sections: string[];
  }[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ type: [Object], default: [] })
  attachments: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];

  // Related documentation
  @Prop({ type: [Types.ObjectId], ref: 'Documentation', default: [] })
  relatedDocs: Types.ObjectId[];

  @Prop()
  lastAccessedAt: Date;
}

export const DocumentationSchema = SchemaFactory.createForClass(Documentation);

DocumentationSchema.index({ title: 'text', content: 'text', tags: 'text' });
DocumentationSchema.index({ type: 1 });
DocumentationSchema.index({ tags: 1 });
DocumentationSchema.index({ categories: 1 });
DocumentationSchema.index({ targets: 1 });
DocumentationSchema.index({ technologies: 1 });
DocumentationSchema.index({ createdBy: 1 });
DocumentationSchema.index({ isPinned: -1, createdAt: -1 });
DocumentationSchema.index({ createdAt: -1 });

