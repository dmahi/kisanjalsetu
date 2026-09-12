import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;
export type DeviceTokenDocument = DeviceToken & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  body?: string;

  @Prop()
  type?: string;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });

/**
 * Registered FCM device tokens, one document per token per user. A user can
 * have multiple active devices; tokens are soft-deactivated (never hard
 * deleted) on logout or when FCM reports the token as invalid/unregistered.
 */
@Schema({ timestamps: true, collection: 'fcm_devices' })
export class DeviceToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  token: string;

  @Prop({ default: 'fcm', enum: ['fcm', 'apns'] })
  platform: string;

  /** Stable per-install id reported by the client (token refresh tracking). */
  @Prop({ index: true })
  deviceId?: string;

  @Prop({ default: 'phone', enum: ['phone', 'tablet', 'web'] })
  deviceType?: string;

  @Prop()
  appVersion?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop()
  lastSeenAt?: Date;

  @Prop()
  lastSuccessAt?: Date;

  @Prop()
  lastFailureAt?: Date;

  @Prop()
  failureReason?: string;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
DeviceTokenSchema.index({ userId: 1, isActive: 1 });