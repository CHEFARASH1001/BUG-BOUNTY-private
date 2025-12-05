import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  VULNERABILITY = 'vulnerability',
  SCAN_COMPLETE = 'scan_complete',
  SCAN_FAILED = 'scan_failed',
  NEW_SUBDOMAIN = 'new_subdomain',
  NEW_ENDPOINT = 'new_endpoint',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, enum: NotificationType })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  data: {
    targetId?: Types.ObjectId;
    targetType?: string;
    severity?: string;
    url?: string;
    [key: string]: unknown;
  };

  @Prop({ default: false })
  read: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ default: false })
  sentToSlack: boolean;

  @Prop({ default: false })
  sentToDiscord: boolean;

  @Prop({ default: false })
  sentToEmail: boolean;

  @Prop({ default: false })
  sentToTelegram: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ read: 1 });
NotificationSchema.index({ createdAt: -1 });

