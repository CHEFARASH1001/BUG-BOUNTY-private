import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertRuleDocument = AlertRule & Document;

export enum AlertConditionType {
  STATUS_CHANGE = 'status_change',
  TITLE_MATCH = 'title_match',
  TECH_CHANGE = 'tech_change',
  FAVICON_CHANGE = 'favicon_change',
  ABUSE_SCORE = 'abuse_score',
}

export enum AlertConditionOperator {
  EQUALS = 'equals',
  CONTAINS = 'contains',
  REGEX = 'regex',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  DISCORD = 'discord',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  EMAIL = 'email',
}

@Schema({ timestamps: true })
export class AlertRule {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: true })
  condition: {
    type: string;
    operator: string;
    value: any;
    previousValue?: any;
  };

  @Prop({ enum: AlertSeverity, default: AlertSeverity.INFO })
  severity: string;

  @Prop({ type: [String], default: [] })
  channels: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;
}

export const AlertRuleSchema = SchemaFactory.createForClass(AlertRule);

AlertRuleSchema.index({ userId: 1 });
AlertRuleSchema.index({ programId: 1 });
AlertRuleSchema.index({ enabled: 1 });
