import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScoreDocument = Score & Document;

export enum ScoreTargetType {
  PROGRAM = 'program',
  DOMAIN = 'domain',
  SUBDOMAIN = 'subdomain',
}

@Schema({ timestamps: true, collection: 'scores' })
export class Score {
  @Prop({ required: true, type: Types.ObjectId, refPath: 'targetType' })
  targetId: Types.ObjectId;

  @Prop({ required: true, enum: ScoreTargetType })
  targetType: ScoreTargetType;

  @Prop({ required: true })
  targetName: string;

  // Penetration Probability Score (0-100)
  @Prop({ default: 0 })
  pentestScore: number;

  // Exposure Score (0-100)
  @Prop({ default: 0 })
  exposureScore: number;

  // Priority Ranking Score (0-100)
  @Prop({ default: 0 })
  priorityScore: number;

  // Final Weighted Score (0-100)
  @Prop({ default: 0 })
  totalScore: number;

  // Score breakdown
  @Prop({ type: Object, default: {} })
  breakdown: {
    // Penetration factors
    exposedServices?: number;
    outdatedTech?: number;
    knownVulns?: number;
    misconfigurations?: number;
    authMechanisms?: number;

    // Exposure factors
    subdomainCount?: number;
    liveHostCount?: number;
    openPortCount?: number;
    httpServiceCount?: number;
    endpointCount?: number;

    // Priority factors
    freshAssetBonus?: number;
    programValue?: number;
    vulnerabilityCount?: number;
  };

  // Historical scores for trending
  @Prop({ type: [Object], default: [] })
  history: {
    date: Date;
    pentestScore: number;
    exposureScore: number;
    priorityScore: number;
    totalScore: number;
  }[];

  @Prop({ default: false })
  isFresh: boolean;

  @Prop()
  calculatedAt: Date;

  @Prop()
  notes: string;
}

export const ScoreSchema = SchemaFactory.createForClass(Score);

ScoreSchema.index({ targetId: 1, targetType: 1 }, { unique: true });
ScoreSchema.index({ targetType: 1 });
ScoreSchema.index({ totalScore: -1 });
ScoreSchema.index({ priorityScore: -1 });
ScoreSchema.index({ pentestScore: -1 });
ScoreSchema.index({ exposureScore: -1 });
ScoreSchema.index({ calculatedAt: -1 });

