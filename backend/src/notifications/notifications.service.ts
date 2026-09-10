import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DeviceToken,
  DeviceTokenDocument,
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { PushSender } from './push.sender';

export interface NotificationInput {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * In-app notification history, plus optional FCM push delivery to every
 * registered device for the user. Both roles see the same history.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceTokenDocument>,
    private readonly pushSender: PushSender,
  ) {}

  async create(input: NotificationInput): Promise<NotificationDocument> {
    const doc: Record<string, unknown> = {
      userId: new Types.ObjectId(input.userId),
      title: input.title,
      body: input.body || null,
      type: input.type || null,
      data: input.data || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = await this.notificationModel.create(doc as any);

    if (this.pushSender.enabled) {
      const tokens = await this.deviceTokenModel
        .find({ userId: new Types.ObjectId(input.userId) })
        .select('token')
        .exec();
      for (const t of tokens) {
        await this.pushSender.send(t.token, {
          title: input.title,
          body: input.body,
          data: { type: input.type || 'info', ...(input.data || {}) },
        });
      }
    }
    return saved;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationModel.updateOne(
      { _id: notificationId, userId: new Types.ObjectId(userId) },
      { readAt: new Date() },
    ).exec();
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), readAt: null },
      { readAt: new Date() },
    ).exec();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId: new Types.ObjectId(userId), readAt: null })
      .exec();
  }

  async registerDeviceToken(userId: string, token: string, platform = 'fcm'): Promise<void> {
    await this.deviceTokenModel.updateOne(
      { userId: new Types.ObjectId(userId), token },
      { platform },
      { upsert: true },
    ).exec();
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenModel.deleteOne({ userId: new Types.ObjectId(userId), token }).exec();
  }
}