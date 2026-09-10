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

/**
 * FCM: grant, register, and upload the device token so the backend can send
 * server push. One-time setup in the app bootstrap.
 *
 * Requires a Firebase project configured (google-services.json) on Android.
 * Without it, calling PushNotifications.register() crashes the native process
 * (Default FirebaseApp is not initialized), so the whole flow is gated behind
 * the VITE_FCM_PUSH flag and skipped by default.
 */
export async function initPushNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;
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
      try {
        await notificationsApi.registerDeviceToken(token.value, 'fcm');
      } catch (err) {
        console.warn('device token upload failed', err);
      }
    });
    ps.addListener('registrationError', (err: unknown) =>
      console.warn('FCM registration error', err),
    );
  } catch (err) {
    console.warn('Push notifications unavailable', err);
  }
}