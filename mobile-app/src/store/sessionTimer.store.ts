import { create } from 'zustand';
import {
  cacheRunningSession,
  clearCachedRunningSession,
  getCachedRunningSession,
  seedSessionNotifications,
  cancelSessionNotifications,
  refreshSessionNotification,
  type RunningSessionCached,
} from '../lib/notifications';

export interface TimerState {
  running: RunningSessionCached | null;
  /** ms elapsed since startDatetime, refreshed every second */
  elapsedMs: number;
  counterVersion: number;
  setRunning: (info: RunningSessionCached | null) => Promise<void>;
  updateElapsed: (ms: number) => void;
  hydrate: () => Promise<void>;
  reseedCounter: () => Promise<void>;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

function startTicker(getState: () => TimerState): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  const running = getState().running;
  if (!running) return;
  const startedAt = new Date(running.startDatetime).getTime();
  const tick = () => getState().updateElapsed(Math.max(0, Date.now() - startedAt));
  tick();
  intervalHandle = setInterval(tick, 1000);
}

export const useSessionTimerStore = create<TimerState>((set, get) => ({
  running: null,
  elapsedMs: 0,
  counterVersion: 0,

  updateElapsed: (ms) => set({ elapsedMs: ms }),

  setRunning: async (info) => {
    const prev = get().running;
    if (prev) await cancelSessionNotifications();

    if (!info) {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      await clearCachedRunningSession();
      set({ running: null, elapsedMs: 0, counterVersion: get().counterVersion + 1 });
      return;
    }

    await cacheRunningSession(info);
    set({ running: info, counterVersion: get().counterVersion + 1 });
    startTicker(get);

    const intervalMinutes = Number(import.meta.env?.VITE_COUNTER_NOTIFY_MINUTES ?? 30);
    await seedSessionNotifications({
      sessionId: info.id,
      customerName: info.customerName ?? undefined,
      startDatetime: info.startDatetime,
      ratePerHourPaise: info.ratePerHourPaise,
      intervalMinutes,
    });
  },

  reseedCounter: async () => {
    const r = get().running;
    if (!r) return;
    const intervalMinutes = Number(import.meta.env?.VITE_COUNTER_NOTIFY_MINUTES ?? 30);
    await refreshSessionNotification({
      sessionId: r.id,
      customerName: r.customerName ?? undefined,
      startDatetime: r.startDatetime,
      ratePerHourPaise: r.ratePerHourPaise,
      intervalMinutes,
    });
  },

  hydrate: async () => {
    if (hydrated) return;
    hydrated = true;
    const cached = await getCachedRunningSession();
    if (!cached) return;
    set({
      running: cached,
      elapsedMs: Math.max(0, Date.now() - new Date(cached.startDatetime).getTime()),
    });
    startTicker(get);
  },
}));

/** Restart the one-second ticker if a running session exists (called once at
 *  app bootstrap and again whenever the app returns to the foreground). */
export function ensureTicker(): void {
  startTicker(useSessionTimerStore.getState as () => TimerState);
}