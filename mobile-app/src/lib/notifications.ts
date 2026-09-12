import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '../api/config';
import { notificationsApi } from '../api/common';

export interface SessionCounterInfo {
  sessionId: string;
  customerName?: string;
  startDatetime: string;
  ratePerHourPaise: number;
  /** beacon interval minutes for reminders (default 30) */
  intervalMinutes: number;
}

const RUNNING_KEY = 'waterapp.running_session';
const START_BASE_ID = 9000;
const FCM_TOKEN_KEY = 'waterapp.fcm_token';
const DEVICE_ID_KEY = 'waterapp.device_id';
export const GENERAL_CHANNEL_ID = 'general';
export const WATER_CHANNEL_ID = 'water';
export const PAYMENTS_CHANNEL_ID = 'payments';
/** High-importance alert channel used for water-turn READY/NOT_READY prompts. */
export const WATER_ALERT_CHANNEL_ID = 'water_turn';

export interface RunningSessionCached {
  id: string;
  customerId: string;
  customerName?: string | null;
  startDatetime: string;
  ratePerHourPaise: number;
  tubewellId?: string;
}

/** Persist the active running session so the counter survives app restarts. */
export async function cacheRunningSession(info: RunningSessionCached): Promise<void> {
  await Preferences.set({ key: RUNNING_KEY, value: JSON.stringify(info) });
}

export async function getCachedRunningSession(): Promise<RunningSessionCached | null> {
  const { value } = await Preferences.get({ key: RUNNING_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as RunningSessionCached;
  } catch {
    return null;
  }
}

export async function clearCachedRunningSession(): Promise<void> {
  await Preferences.remove({ key: RUNNING_KEY });
  await cancelSessionNotifications();
}

/** Guarded wrappers — no-ops and warnings on web, real behavior on device. */
let permissionsGranted = false;

async function ensurePermissions(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    permissionsGranted = req.display === 'granted';
    return permissionsGranted;
  } catch (err) {
    console.warn('Local notification permission error', err);
    return false;
  }
}

/** Schedule an unbounded repeating reminder + snapshot one-shots while a water
 *  session is running. This is the timer/counter push notification: every
 *  intervalMinutes the operator is nudged with elapsed time and the running bill.
 */
export async function seedSessionNotifications(info: SessionCounterInfo): Promise<void> {
  if (!(await ensurePermissions())) return;

  await LocalNotifications.cancel({ notifications: [{ id: START_BASE_ID + 1 }] });
  await LocalNotifications.cancel({ notifications: [{ id: START_BASE_ID + 2 }] });

  const startedMs = new Date(info.startDatetime).getTime();
  const estimateAt = (offsetMinutes: number) => {
    const elapsedMin = Math.max(0, Math.round((Date.now() - startedMs) / 60000) + offsetMinutes);
    const amount = Math.round((info.ratePerHourPaise * elapsedMin) / 60 / 100);
    const h = Math.floor(elapsedMin / 60);
    const m = elapsedMin % 60;
    return { time: `${h}h ${m}m`, amount };
  };

  // One-shot follow-up notification `intervalMinutes` after start.
  const s1 = estimateAt(info.intervalMinutes);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: START_BASE_ID + 1,
        title: '⏱ Water still running',
        body: `${info.customerName ?? 'Water'} session running · ${s1.time} · approx ₹${s1.amount}. Stop when done.`,
        schedule: { at: new Date(startedMs + info.intervalMinutes * 60000) },
        channelId: GENERAL_CHANNEL_ID,
        sound: 'default',
        smallIcon: 'ic_stat_water',
      },
    ],
  });

  // Hourly repeating reminder while running (approx 36h max on Android interval cap).
  const s2 = estimateAt(60);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: START_BASE_ID + 2,
        title: '🕐 Session counter',
        body: `${info.customerName ?? 'Water'} · ~1h elapsed · approx ₹${s2.amount}. Stop this session when finished.`,
        schedule: { every: 'hour', count: 36 },
        channelId: GENERAL_CHANNEL_ID,
        sound: 'default',
        smallIcon: 'ic_stat_water',
      },
    ],
  });
}

export async function refreshSessionNotification(info: SessionCounterInfo): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: START_BASE_ID + 1 }] });
    const startedMs = new Date(info.startDatetime).getTime();
    const elapsedMin = Math.max(0, Math.round((Date.now() - startedMs) / 60000) + info.intervalMinutes);
    const amount = Math.round((info.ratePerHourPaise * elapsedMin) / 60 / 100);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: START_BASE_ID + 1,
          title: '⏱ Water still running',
          body: `${info.customerName ?? 'Water'} · ~${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m · approx ₹${amount}.`,
          schedule: { at: new Date(startedMs + info.intervalMinutes * 60000) },
          channelId: GENERAL_CHANNEL_ID,
          sound: 'default',
          smallIcon: 'ic_stat_water',
        },
      ],
    });
  } catch (err) {
    console.warn('refreshSessionNotification failed', err);
  }
}

export async function cancelSessionNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: START_BASE_ID + 1 }, { id: START_BASE_ID + 2 }] });
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * FCM device token lifecycle                                          *
 * ------------------------------------------------------------------ */

/** Latest FCM token known to this install (nil until FCM registers). */
let latestFcmToken: string | null = null;
/** Notification payload captured when the app was launched from a tap. */
let pendingNotificationAction: Record<string, unknown> | null = null;
/** Injected by the router so a background/closed tap can deep-link. */
let pushNavigator: ((path: string) => void) | null = null;

/** Let the React router provide a navigation function for notification taps. */
export function setPushNavigator(fn: (path: string) => void): void {
  pushNavigator = fn;
  if (pendingNotificationAction) {
    const action = pendingNotificationAction;
    pendingNotificationAction = null;
    void routeFromAction(action);
  }
}

/** Data captured when a tap launched a cold/backgrounded app (before router). */
export function getPendingNotificationAction(): Record<string, unknown> | null {
  return pendingNotificationAction;
}

/** FCM token to send on logout / re-upload after login. */
export async function getFcmToken(): Promise<string | null> {
  if (latestFcmToken) return latestFcmToken;
  const { value } = await Preferences.get({ key: FCM_TOKEN_KEY });
  return value || null;
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceId(): Promise<string> {
  const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
  if (value) return value;
  const id = generateDeviceId();
  await Preferences.set({ key: DEVICE_ID_KEY, value: id });
  return id;
}

async function getAppVersion(): Promise<string | undefined> {
  try {
    const info = await App.getInfo();
    return info?.version;
  } catch {
    return undefined;
  }
}

function detectDeviceType(): string {
  if (!isCapacitorNative()) return 'web';
  const ua = navigator.userAgent.toLowerCase();
  return /tablet|ipad/i.test(ua) ? 'tablet' : 'phone';
}

/**
 * Upload the current FCM token together with device metadata. No-ops until a
 * token exists and the user is authenticated.
 */
export async function uploadDeviceToken(): Promise<void> {
  const token = latestFcmToken || (await getFcmToken());
  if (!token) return;
  const auth = localStorage.getItem('waterapp.token') || (await Preferences.get({ key: 'waterapp.token' })).value;
  if (!auth) return;
  const [deviceId, appVersion] = await Promise.all([getDeviceId(), getAppVersion()]);
  try {
    await notificationsApi.registerDeviceToken({
      token,
      deviceId,
      deviceType: detectDeviceType(),
      appVersion,
    });
  } catch (err) {
    console.warn('device token upload failed', err);
  }
}

/** Deactivate the current device's token on the server (logout). */
export async function deactivateDeviceToken(): Promise<void> {
  const token = latestFcmToken || (await getFcmToken());
  if (!token) return;
  try {
    await notificationsApi.logoutDeviceToken(token);
  } catch (err) {
    console.warn('device token logout failed', err);
  }
  latestFcmToken = null;
  await Preferences.remove({ key: FCM_TOKEN_KEY });
}

async function ensureNotificationChannel(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    // Delete existing alert channel to allow updating sound & importance settings
    try {
      await LocalNotifications.deleteChannel({ id: WATER_ALERT_CHANNEL_ID });
    } catch {
      /* ignore if non-existent */
    }

    await LocalNotifications.createChannel({
      id: GENERAL_CHANNEL_ID,
      name: 'General',
      description: 'Water status and session notifications',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: WATER_CHANNEL_ID,
      name: 'Water sessions',
      description: 'Water started / stopped and session updates',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: PAYMENTS_CHANNEL_ID,
      name: 'Payments',
      description: 'Payment requests and approvals',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: WATER_ALERT_CHANNEL_ID,
      name: 'Water turn alerts',
      description: 'Get ready / confirm READY or NOT READY for your water turn',
      importance: 5, // IMPORTANCE_MAX: Heads-up banner display
      visibility: 1, // VISIBILITY_PUBLIC: Show full banner on lock screen
      sound: 'incoming_call', // plays res/raw/incoming_call.wav
      vibration: true,
      lights: true,
      lightColor: '#0284C7',
    });
  } catch (err) {
    console.warn('notification channel failed', err);
  }
}

/** Show the incoming foreground FCM notification as a local banner. */
function displayForegroundNotification(payload: Record<string, unknown>): void {
  const raw = payload?.data;
  const parsed =
    typeof raw === 'string'
      ? safeParse(raw)
      : (raw as Record<string, unknown> | undefined) ?? {};
  const type = typeof parsed?.type === 'string' ? parsed.type : '';
  const isTurnAlert = type.startsWith('water_turn');
  void (async () => {
    if (!(await ensurePermissions())) return;
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() / 1000) % 2147483647,
            title: payload?.title ? String(payload.title) : 'KisanJalSetu',
            body: payload?.body ? String(payload.body) : '',
            channelId: isTurnAlert ? WATER_ALERT_CHANNEL_ID : GENERAL_CHANNEL_ID,
            sound: isTurnAlert ? 'incoming_call' : 'default',
            smallIcon: 'ic_stat_water',
            extra: parsed,
          },
        ],
      });
    } catch (err) {
      console.warn('foreground notification failed', err);
    }
  })();
}

import { notificationRouteFor } from './deeplink';

/** Pure mapping of a push type + role to an in-app route (used for deep links). */
export { notificationRouteFor } from './deeplink';

/** Map a notification action (tap) to a route using role + message data. */
function routeFromAction(payload: Record<string, unknown>): void {
  const raw = typeof payload?.data === 'string' ? safeParse(payload.data) : (payload?.data as Record<string, unknown> | undefined);
  const type = typeof raw?.type === 'string' ? raw.type : 'info';
  const userRaw = localStorage.getItem('waterapp.auth_user');
  let role = 'farmer';
  if (userRaw) {
    try {
      role = (JSON.parse(userRaw) as { role?: string }).role || role;
    } catch {
      /* ignore */
    }
  }
  const path = notificationRouteFor(type, role);
  if (pushNavigator) pushNavigator(path);
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * FCM: grant, register, and upload the device token so the backend can send
 * server push. One-time setup in the app bootstrap. Also wires channel
 * creation, foreground display, and background/closed tap navigation.
 *
 * Requires a Firebase project configured (google-services.json) on Android.
 * Without it, calling PushNotifications.register() crashes the native process
 * (Default FirebaseApp is not initialized), so FCM registration is gated behind
 * the VITE_FCM_PUSH flag or skips gracefully if unavailable.
 */
export async function initPushNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;
  // Always initialize high-priority notification channels (including call sound channel)
  await ensureNotificationChannel();

  if (import.meta.env?.VITE_FCM_PUSH !== 'true') return;
  try {
    const ps = PushNotifications;
    const status = await ps.checkPermissions();
    if (status.receive !== 'granted') {
      const req = await ps.requestPermissions();
      if (req.receive !== 'granted') return;
    }
    await ps.register();
    ps.addListener('registration', async (token: { value: string }) => {
      latestFcmToken = token.value;
      await Preferences.set({ key: FCM_TOKEN_KEY, value: token.value });
      await uploadDeviceToken();
    });
    ps.addListener('registrationError', (err: unknown) =>
      console.warn('FCM registration error', err),
    );
    ps.addListener('pushNotificationReceived', (n: unknown) => {
      const payload = n as { title?: string; body?: string; data?: string };
      displayForegroundNotification(payload as Record<string, unknown>);
    });
    ps.addListener('pushNotificationActionPerformed', (n: unknown) => {
      const action = n as { notification?: { data?: unknown } };
      const raw = action?.notification?.data;
      const parsed =
        typeof raw === 'string'
          ? safeParse(raw)
          : (raw as Record<string, unknown> | undefined) ?? {};
      if (pushNavigator) {
        routeFromAction({ data: parsed } as Record<string, unknown>);
      } else {
        pendingNotificationAction = parsed;
      }
    });
  } catch (err) {
    console.warn('Push notifications unavailable', err);
  }
}