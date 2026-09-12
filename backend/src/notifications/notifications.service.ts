import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { FcmService } from './fcm.service';

export interface NotificationInput {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  data?: Record<string, unknown>;
  /** Android notification channel id (defaults to type-based mapping). */
  channel?: string;
  /** FCM priority used for time-sensitive pushes (e.g. water-turn alerts). */
  priority?: 'high' | 'normal';
  /** Custom notification sound on Android. */
  sound?: string;
}

/**
 * In-app notification history, plus optional FCM push delivery to every
 * registered device for the user via FcmService.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly fcmService: FcmService,
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

    // Fire-and-forget: push must never block the API response.
    this.fcmService
      .sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type || 'info', ...(input.data || {}) },
        channel: input.channel || this.mapTypeToChannel(input.type),
        priority: input.priority,
        sound: input.sound,
      })
      .catch(() => undefined);

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

  private mapTypeToChannel(type?: string): string {
    if (!type) return 'general';
    if (type.startsWith('water') || type.startsWith('session')) return 'water';
    if (type.startsWith('payment')) return 'payments';
    return 'general';
  }
}