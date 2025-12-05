import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['admin', 'user', 'viewer'], default: 'user' })
  role: string;

  @Prop({ type: Object, default: {} })
  apiKeys: {
    shodan?: string;
    securityTrails?: string;
    virusTotal?: string;
    censys?: { id: string; secret: string };
    hunter?: string;
    github?: string;
    urlscan?: string;
  };

  @Prop({ type: Object, default: {} })
  notifications: {
    email?: boolean;
    slack?: boolean;
    discord?: boolean;
    telegram?: boolean;
    onNewVuln?: boolean;
    onScanComplete?: boolean;
    onNewSubdomain?: boolean;
    minSeverity?: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLogin: Date;

  @Prop()
  refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for faster lookups
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

