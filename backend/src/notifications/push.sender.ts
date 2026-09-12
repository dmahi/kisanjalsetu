import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Android notification channel id (must already exist client-side). */
  channel?: string;
  /** FCM priority — 'high' for time-sensitive alerts (heads-up display). */
  priority?: 'high' | 'normal';
  /** Custom notification sound on Android (file name or default). */
  sound?: string;
  /** Group tag so consecutive alerts replace each other on Android. */
  tag?: string;
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

import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PushSender {
  private readonly logger = new Logger('PushSender');
  private warned = false;

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getFcmCredentials(): Promise<{ serviceAccount: ServiceAccount | null; legacyKey: string }> {
    let serviceAccountRaw = '';
    let legacyKey = '';
    try {
      const dbSettings = await this.settingsService.getSettings();
      serviceAccountRaw = dbSettings.firebaseServiceAccount || '';
      legacyKey = dbSettings.firebaseServerKey || '';
    } catch {
      /* fallback to env vars */
    }

    if (!serviceAccountRaw) {
      serviceAccountRaw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT', '');
    }
    if (!legacyKey) {
      legacyKey = this.config.get<string>('FIREBASE_SERVER_KEY', '');
    }

    let serviceAccount: ServiceAccount | null = null;
    if (serviceAccountRaw) {
      try {
        serviceAccount = JSON.parse(serviceAccountRaw) as ServiceAccount;
      } catch {
        serviceAccount = null;
      }
    }

    if (!serviceAccount) {
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', '');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL', '');
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY', '');
      if (projectId && clientEmail && privateKey) {
        serviceAccount = {
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

    return { serviceAccount, legacyKey };
  }

  async send(token: string, payload: PushPayload): Promise<FcmSendResult> {
    const { serviceAccount, legacyKey } = await this.getFcmCredentials();
    if (!serviceAccount && !legacyKey) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          'FCM not configured (set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVER_KEY in Settings or env); push disabled',
        );
      }
      return { ok: false, permanent: false, error: 'FCM not configured' };
    }
    try {
      if (serviceAccount) return await this.sendV1(serviceAccount, token, payload);
      return await this.sendLegacy(legacyKey, token, payload);
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
    if (payload.channel || payload.sound || payload.priority || payload.tag) {
      const androidNotification: Record<string, unknown> = {
        channel_id: payload.channel || 'water_turn',
        sound: payload.sound || (payload.priority === 'high' ? 'incoming_call' : 'default'),
      };
      if (payload.priority === 'high') {
        androidNotification.priority = 'PRIORITY_MAX';
        androidNotification.visibility = 'PUBLIC';
        androidNotification.default_sound = false;
        androidNotification.default_vibrate_timings = false;
        androidNotification.vibrate_timings = ['0s', '0.5s', '0.5s', '1s'];
      }
      if (payload.tag) androidNotification.tag = payload.tag;
      const android: Record<string, unknown> = { notification: androidNotification };
      if (payload.priority === 'high') android.priority = 'high';
      message.android = android;
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

  private async sendLegacy(legacyKey: string, token: string, payload: PushPayload): Promise<FcmSendResult> {
    const isHigh = payload.priority === 'high';
    const soundName = payload.sound || (isHigh ? 'incoming_call' : 'default');
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${legacyKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        priority: isHigh ? 'high' : 'normal',
        notification: {
          title: payload.title,
          body: payload.body || '',
          sound: soundName,
          android_channel_id: payload.channel || 'water_turn',
        },
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