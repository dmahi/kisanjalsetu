import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { useAuthStore } from './store/auth.store';
import { useSessionTimerStore, ensureTicker } from './store/sessionTimer.store';
import { useSelectionStore } from './store/tubewellSelection.store';
import {
  initPushNotifications,
  seedSessionNotifications,
  setPushNavigator,
  uploadDeviceToken,
} from './lib/notifications';
import { initNetworkMonitor, subscribeNetworkStatus } from './lib/network';
import { flushQueue, queuedCount } from './lib/offlineQueue';
import { AppRoutes } from './router';

export default function App() {
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTimer = useSessionTimerStore((s) => s.hydrate);
  const hydrateSelection = useSelectionStore((s) => s.hydrate);
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    void hydrateAuth();
    void hydrateSelection();
    void hydrateTimer().then(() => ensureTicker());
    void initPushNotifications();

    const stopMonitor = initNetworkMonitor(true).catch(() => () => undefined);
    const unsub = subscribeNetworkStatus((s) => {
      setOnline(s.connected);
      if (s.connected) {
        queuedCount().then(setQueued).catch(() => undefined);
      }
    });

    // On resume: restart ticker, refresh counter notifications, flush queue.
    const resume = () => {
      const info = useSessionTimerStore.getState().running;
      if (info) {
        ensureTicker();
        seedSessionNotifications({
          sessionId: info.id,
          customerName: info.customerName ?? undefined,
          startDatetime: info.startDatetime,
          ratePerHourPaise: info.ratePerHourPaise,
          intervalMinutes: Number(import.meta.env?.VITE_COUNTER_NOTIFY_MINUTES ?? 30),
        }).catch(() => undefined);
      }
      flushQueue().then(() => queuedCount().then(setQueued)).catch(() => undefined);
    };
    void CapApp.addListener('resume', resume).catch(() => undefined);

    return () => {
      unsub();
      void stopMonitor.then((stop) => stop());
      CapApp.removeAllListeners().catch(() => undefined);
    };
  }, [hydrateAuth, hydrateTimer]);

  // Provide the router navigate function so notification taps can deep-link
  // from outside React context (Capacitor push listeners).
  useEffect(() => {
    if (!user) return;
    setPushNavigator((path: string) => navigate(path, { replace: true }));
  }, [navigate, user]);

  // Re-upload FCM token with device info after login completes / user becomes
  // available (registration listener runs before auth is hydrated).
  useEffect(() => {
    if (user) void uploadDeviceToken();
  }, [user]);

  if (!initialized) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app">
      {!online ? <div className="offline-banner">Offline — changes will sync when back online</div> : null}
      {online && queued > 0 ? (
        <div className="offline-banner" style={{ background: 'var(--green)' }}>
          Syncing {queued} pending action{queued > 1 ? 's' : ''}…
        </div>
      ) : null}
      <AppRoutes />
    </div>
  );
}