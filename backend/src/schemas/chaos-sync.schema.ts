import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChaosSyncDocument = ChaosSync & Document;

@Schema({ timestamps: true })
export class ChaosSync {
  @Prop({ required: true })
  programName: string;

  @Prop()
  chaosUrl: string;

  @Prop({ default: 0 })
  subdomainsImported: number;

  @Prop({ default: 0 })
  newSubdomains: number;

  @Prop()
  syncedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ default: false })
  watchEnabled: boolean;
}

export const ChaosSyncSchema = SchemaFactory.createForClass(ChaosSync);

ChaosSyncSchema.index({ programName: 1 });
ChaosSyncSchema.index({ programId: 1 });
