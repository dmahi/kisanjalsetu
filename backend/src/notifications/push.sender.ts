import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Lightweight Firebase Cloud Messaging sender (legacy HTTP API).
 * Requires FIREBASE_SERVER_KEY. When unconfigured it logs once and no-ops so
 * in-app notification history still works for the whole flow.
 */
@Injectable()
export class PushSender {
  private readonly logger = new Logger('PushSender');
  private readonly key = this.config.get<string>('FIREBASE_SERVER_KEY', '');
  private warned = false;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.key);
  }

  async send(token: string, payload: PushPayload): Promise<void> {
    if (!this.key) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn('FIREBASE_SERVER_KEY not set; push disabled');
      }
      return;
    }
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${this.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: { title: payload.title, body: payload.body || '', sound: 'default' },
          data: payload.data || {},
        }),
      });
      if (!res.ok) {
        this.logger.warn(`FCM send failed (${res.status}): ${await res.text()}`);
      }
    } catch (err) {
      this.logger.error(`FCM push error: ${(err as Error).message}`);
    }
  }
}