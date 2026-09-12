import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DeviceToken,
  DeviceTokenDocument,
} from './schemas/notification.schema';
import { PushSender, PushPayload, FcmSendResult } from './push.sender';

export interface RegisterTokenInput {
  token: string;
  platform?: string;
  deviceId?: string;
  deviceType?: string;
  appVersion?: string;
}

/**
 * Owns the fcm_devices collection lifecycle and every FCM send path:
 *
 * - token registration (upsert, one active token per token/device)
 * - logout deactivation (soft-deletes only the calling device)
 * - sendToToken / sendToTokens / sendToUser — every push funnels through here
 *   so FCM "dead token" responses deactivate that device while transient
 *   errors are recorded without touching the record.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger('FcmService');

  constructor(
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceTokenDocument>,
    private readonly pushSender: PushSender,
  ) {}

  /**
   * Register/refresh a device token. When the same device reports a *different*
   * token (FCM token rotation) the previous active token for that deviceId is
   * deactivated first. The token value itself is upserted per user, so repeated
   * registrations never create duplicate active rows.
   */
  async registerToken(userId: string, input: RegisterTokenInput): Promise<void> {
    const uid = new Types.ObjectId(userId);
    const token = input.token.trim();
    const now = new Date();

    // Rotated token for the same physical device — deactivate the old one
    // (matching on deviceId regardless of userId covers device handover too).
    if (input.deviceId) {
      await this.deviceTokenModel
        .updateMany(
          { deviceId: input.deviceId, token: { $ne: token }, isActive: true },
          {
            isActive: false,
            failureReason: 'replaced_by_refresh',
            lastFailureAt: now,
          },
        )
        .exec();
    }

    // Same token logged in on a different account — deactivate the stale rows
    // so only the current user stays active on this device token.
    await this.deviceTokenModel
      .updateMany(
        { token, userId: { $ne: uid }, isActive: true },
        {
          isActive: false,
          failureReason: 'reassigned_to_another_user',
          lastFailureAt: now,
        },
      )
      .exec();

    await this.deviceTokenModel
      .findOneAndUpdate(
        { userId: uid, token },
        {
          $set: {
            platform: input.platform || 'fcm',
            deviceId: input.deviceId ?? null,
            deviceType: input.deviceType || 'phone',
            appVersion: input.appVersion ?? null,
            isActive: true,
            lastSeenAt: now,
            failureReason: null,
          },
        },
        { upsert: true, setDefaultsOnInsert: true, new: true },
      )
      .exec();
  }

  /** Soft-deactivate the exact token (logout). Other devices stay active. */
  async deactivateUserDeviceToken(
    userId: string,
    token: string,
    reason = 'logged_out',
  ): Promise<boolean> {
    const result = await this.deviceTokenModel
      .updateOne(
        { userId: new Types.ObjectId(userId), token: token.trim() },
        { isActive: false, failureReason: reason, lastFailureAt: new Date() },
      )
      .exec();
    return (result.modifiedCount ?? 0) > 0;
  }

  /** Hard-delete (app uninstall / explicit cleanup, kept for API compatibility). */
  async unregisterToken(userId: string, token: string): Promise<boolean> {
    const result = await this.deviceTokenModel
      .deleteOne({ userId: new Types.ObjectId(userId), token: token.trim() })
      .exec();
    return (result.deletedCount ?? 0) > 0;
  }

  /** Send to one token and record the outcome (deactivate on permanent FCM errors). */
  async sendToToken(userId: string, token: string, payload: PushPayload): Promise<FcmSendResult> {
    const res = await this.pushSender.send(token, payload);
    await this.recordResult(userId, token, res);
    return res;
  }

  /** Send to a specific set of already-known tokens (bypasses user scoping). */
  async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    for (const token of tokens) {
      const res = await this.pushSender.send(token, payload);
      if (!res.ok && res.permanent) {
        await this.deviceTokenModel
          .updateOne(
            { token, isActive: true },
            {
              isActive: false,
              failureReason: res.error || 'unregistered_token',
              lastFailureAt: new Date(),
            },
          )
          .exec();
      }
    }
  }

  /** Send to every active device of a user. The core push path. */
  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number; deactivated: number }> {
    const devices = await this.deviceTokenModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .select('token')
      .lean()
      .exec();

    let sent = 0;
    let failed = 0;
    let deactivated = 0;
    for (const t of devices) {
      const res = await this.pushSender.send(t.token, payload);
      if (!res.ok) {
        failed++;
        if (res.permanent) {
          deactivated++;
          await this.deviceTokenModel
            .updateOne(
              { _id: t._id },
              {
                isActive: false,
                failureReason: res.error || 'unregistered_token',
                lastFailureAt: new Date(),
              },
            )
            .exec();
        } else {
          await this.deviceTokenModel
            .updateOne(
              { _id: t._id },
              { lastFailureAt: new Date(), failureReason: res.error || 'temporary_failure' },
            )
            .exec();
        }
        continue;
      }
      sent++;
      await this.deviceTokenModel.updateOne({ _id: t._id }, { lastSuccessAt: new Date() }).exec();
    }
    return { sent, failed, deactivated };
  }

  private async recordResult(
    userId: string,
    token: string,
    res: FcmSendResult,
  ): Promise<void> {
    if (res.ok) {
      await this.deviceTokenModel
        .updateOne({ userId: new Types.ObjectId(userId), token, isActive: true }, { lastSuccessAt: new Date() })
        .exec();
      return;
    }
    const update: Record<string, unknown> = {
      lastFailureAt: new Date(),
      failureReason: res.error || 'send_failed',
    };
    if (res.permanent) update.isActive = false;
    await this.deviceTokenModel
      .updateOne({ userId: new Types.ObjectId(userId), token, isActive: true }, update)
      .exec();
  }
}