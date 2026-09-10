import { Network } from '@capacitor/network';
import { flushQueue } from './offlineQueue';
import { isCapacitorNative } from '../api/config';

export type NetworkListener = (status: { connected: boolean; type?: string }) => void;

const listeners = new Set<NetworkListener>();

function currentStatus(connected: boolean, type?: string): { connected: boolean; type?: string } {
  return { connected, type };
}

/** Subscribe to connectivity changes. When we come back online the offline
 *  queue is flushed automatically (idempotency keys make replays safe). */
export function subscribeNetworkStatus(cb: NetworkListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function initNetworkMonitor(syncOnReconnect: boolean): Promise<() => void> {
  const emit = (connected: boolean, type?: string) => {
    const status = currentStatus(connected, type);
    listeners.forEach((cb) => cb(status));
  };

  let unregister: (() => Promise<void>) | null = null;
  if (isCapacitorNative()) {
    const plugin = Network;
    const handler = await plugin.addListener('networkStatusChange', (s) => {
      emit(s.connected, s.connectionType);
      if (s.connected && syncOnReconnect) {
        flushQueue().catch(() => undefined);
      }
    });
    unregister = async () => {
      await handler.remove();
    };
    try {
      const s = await plugin.getStatus();
      emit(s.connected, s.connectionType);
    } catch {
      emit(true);
    }
  } else {
    emit(navigator.onLine);
    window.addEventListener('online', () => {
      emit(true);
      if (syncOnReconnect) flushQueue().catch(() => undefined);
    });
    window.addEventListener('offline', () => emit(false));
  }
  return () => {
    unregister?.();
  };
}