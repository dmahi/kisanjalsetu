import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Android notification channel id (must already exist client-side). */
  channel?: string;
}

export interface FcmSendResult {
  ok: boolean;
  /** True when the token is permanently invalid — the caller should deactivate it. */
  permanent: boolean;
  error?: string;
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

const PERMANENT_V1_CODES = new Set(['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND']);
const PERMANENT_LEGACY_ERRORS = new Set([
  'NotRegistered',
  'InvalidRegistration',
  'MismatchSenderId',
  'InvalidToken',
]);

@Injectable()
export class PushSender {
  private readonly logger = new Logger('PushSender');
  private readonly serviceAccountRaw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT', '');
  private readonly legacyKey = this.config.get<string>('FIREBASE_SERVER_KEY', '');
  private warned = false;
  private cachedServiceAccount: ServiceAccount | null | undefined;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.serviceAccountRaw || this.legacyKey);
  }

  private get serviceAccount(): ServiceAccount | null {
    if (this.cachedServiceAccount !== undefined) return this.cachedServiceAccount;
    try {
      this.cachedServiceAccount = JSON.parse(this.serviceAccountRaw) as ServiceAccount;
    } catch {
      this.cachedServiceAccount = null;
    }

    // Fallback: individual FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY
    // (avoids multiline JSON in the environment; Render supports both styles).
    if (!this.cachedServiceAccount) {
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', '');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL', '');
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY', '');
      if (projectId && clientEmail && privateKey) {
        this.cachedServiceAccount = {
          type: 'service_account',
          project_id: projectId,
          private_key_id: '',
          private_key: privateKey.replace(/\\n/g, '\n'),
          client_email: clientEmail,
          client_id: '',
          token_uri: 'https://oauth2.googleapis.com/token',
        };
      }
    }
    return this.cachedServiceAccount;
  }

  async send(token: string, payload: PushPayload): Promise<FcmSendResult> {
    if (!this.enabled) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          'FCM not configured (set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVER_KEY); push disabled',
        );
      }
      return { ok: false, permanent: false, error: 'FCM not configured' };
    }
    try {
      if (this.serviceAccount) return await this.sendV1(this.serviceAccount, token, payload);
      return await this.sendLegacy(token, payload);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`FCM push error: ${msg}`);
      return { ok: false, permanent: false, error: msg };
    }
  }

  private async sendV1(sa: ServiceAccount, token: string, payload: PushPayload): Promise<FcmSendResult> {
    const accessToken = await this.fetchAccessToken(sa);
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload.data || {})) {
      data[k] = typeof v === 'string' ? v : JSON.stringify(v ?? null);
    }
    const message: Record<string, unknown> = {
      token,
      notification: { title: payload.title, body: payload.body || '' },
      data,
    };
    if (payload.channel) {
      message.android = { notification: { channel_id: payload.channel } };
    }
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (res.ok) return { ok: true, permanent: false };

    let body: { error?: { code?: string; status?: string; message?: string } } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* non-JSON body */
    }
    const status = body.error?.status || '';
    const msg = body.error?.message || String(res.status);
    const permanent = PERMANENT_V1_CODES.has(status) || res.status === 404;
    this.logger.warn(`FCM v1 send failed (${res.status}): ${msg}`);
    return { ok: false, permanent, error: msg };
  }

  private async fetchAccessToken(sa: ServiceAccount): Promise<string> {
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

  private async sendLegacy(token: string, payload: PushPayload): Promise<FcmSendResult> {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${this.legacyKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        notification: { title: payload.title, body: payload.body || '', sound: 'default' },
        data: payload.data || {},
      }),
    });
    if (res.ok) return { ok: true, permanent: false };
    let body: { results?: { error?: string }[] } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* non-JSON */
    }
    const errCode = body.results?.[0]?.error || String(res.status);
    const permanent = PERMANENT_LEGACY_ERRORS.has(errCode);
    this.logger.warn(`FCM legacy send failed (${res.status}): ${errCode}`);
    return { ok: false, permanent, error: errCode };
  }
}