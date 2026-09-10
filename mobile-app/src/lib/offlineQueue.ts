import { Preferences } from '@capacitor/preferences';
import type { SyncOperation } from '../api/sync';
import { syncApi } from '../api/sync';
import { getEffectiveToken } from '../api/client';

const QUEUE_KEY = 'waterapp.offline_queue';

export interface QueueItem extends SyncOperation {
  queuedAt: number;
}

/** Enqueue an offline operation (start/stop/manual session, payment, request).
 *  If online-capable token exists and we are online, it is flushed immediately. */
export async function enqueueOfflineOperation(
  op: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<QueueItem> {
  const item: QueueItem = { op, idempotencyKey, payload, queuedAt: Date.now() };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);

  if (await canFlush()) {
    await flushQueue().catch(() => {
      /* network race — stays queued */
    });
  }
  return item;
}

export async function readQueue(): Promise<QueueItem[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as QueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue.slice(-500)) });
}

/** Send every queued operation. Duplicates are prevented server-side by the
 *  idempotency keys — safe to retry. */
export async function flushQueue(): Promise<number> {
  if (!(await canFlush())) return 0;
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const sent = await syncApi.batch(
    queue.map(({ op, idempotencyKey, payload }) => ({ op, idempotencyKey, payload })),
  );
  // backend returns results keyed by idempotencyKey; success list not needed for V1.
  void sent;
  const remaining = queue.filter((item) => {
    const result = sent?.results?.[item.idempotencyKey] as { ok?: boolean } | undefined;
    // Keep failures (network / validation) only when transport failed, drop accepted ones.
    return result && result.ok === false;
  });
  await writeQueue(remaining);
  const flushed = queue.length - remaining.length;
  if (flushed > 0) {
    await Preferences.set({
      key: 'waterapp.last_sync_at',
      value: String(Date.now()),
    });
  }
  return flushed;
}

async function canFlush(): Promise<boolean> {
  if (!(await getEffectiveToken())) return false;
  return globalThis.navigator?.onLine !== false;
}

export async function queuedCount(): Promise<number> {
  return (await readQueue()).length;
}