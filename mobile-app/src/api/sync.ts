import { apiRequest } from './client';

export interface SyncOperation {
  op: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

/** Dispatch a batch of queued offline operations to the server. Each op carries
 *  its own idempotency key so replays are harmless. */
export const syncApi = {
  batch: (operations: SyncOperation[]): Promise<{ results: Record<string, unknown> }> =>
    apiRequest({ url: '/sync/batch', method: 'POST', data: { operations } }),
};