import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

/**
 * Firebase Cloud Messaging sender supporting two credential styles:
 *
 * 1. Modern HTTP v1 API (recommended, works in 2026): set
 *    FIREBASE_SERVICE_ACCOUNT to the JSON of a service account downloaded from
 *    Firebase console → Project settings → Service accounts → "Generate new
 *    private key". An OAuth2 token is minted locally via RS256 JWT (no extra
 *    dependencies) and posted to /v1/projects/{project_id}/messages:send.
 *
 * 2. Legacy HTTP API (retired by Google, kept for older projects): fall back
 *    to FIREBASE_SERVER_KEY when the service account is absent.
 *
 * When no credentials are configured it logs once and no-ops so in-app
 * notification history keeps working for the whole flow.
 */
@Injectable()
export class PushSender {
  private readonly logger = new Logger('PushSender');
  private readonly serviceAccountRaw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT', '');
  private readonly legacyKey = this.config.get<string>('FIREBASE_SERVER_KEY', '');
  private warned = false;

  private cachedServiceAccount: FirebaseServiceAccount | null | undefined;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.serviceAccountRaw || this.legacyKey);
  }

  private get serviceAccount(): FirebaseServiceAccount | null {
    if (this.cachedServiceAccount !== undefined) return this.cachedServiceAccount;
    try {
      this.cachedServiceAccount = JSON.parse(this.serviceAccountRaw) as FirebaseServiceAccount;
    } catch {
      this.cachedServiceAccount = null;
    }
    return this.cachedServiceAccount;
  }

  async send(token: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          'FCM not configured (set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVER_KEY); server push disabled',
        );
      }
      return;
    }
    try {
      if (this.serviceAccount) {
        await this.sendV1(this.serviceAccount, token, payload);
      } else {
        await this.sendLegacy(token, payload);
      }
    } catch (err) {
      this.logger.error(`FCM push error: ${(err as Error).message}`);
    }
  }

  /** FCM HTTP v1: mint an OAuth2 token from the service account, then send. */
  private async sendV1(sa: FirebaseServiceAccount, token: string, payload: PushPayload): Promise<void> {
    const accessToken = await this.fetchAccessToken(sa);
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload.data || {})) {
      data[k] = typeof v === 'string' ? v : JSON.stringify(v ?? null);
    }
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body || '' },
          data,
        },
      }),
    });
    if (!res.ok) {
      this.logger.warn(`FCM v1 send failed (${res.status}): ${await res.text()}`);
    }
  }

  private async fetchAccessToken(sa: FirebaseServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signed = [
      b64({ alg: 'RS256', typ: 'JWT' }),
      b64({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ].join('.');
    const signature = crypto.createSign('RSA-SHA256').update(signed).sign(sa.private_key, 'base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signed}.${signature}`,
    });
    const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!res.ok || !json.access_token) {
      throw new Error(`OAuth token failed: ${json.error_description || json.error || res.status}`);
    }
    return json.access_token;
  }

  /** Retired legacy HTTP API — kept only for older Firebase projects. */
  private async sendLegacy(token: string, payload: PushPayload): Promise<void> {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${this.legacyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: { title: payload.title, body: payload.body || '', sound: 'default' },
        data: payload.data || {},
      }),
    });
    if (!res.ok) {
      this.logger.warn(`FCM legacy send failed (${res.status}): ${await res.text()}`);
    }
  }
}