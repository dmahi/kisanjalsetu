import { apiRequest } from './client';

export interface WaterQueueEntry {
  id: string;
  tubewellId: string;
  tubewellName?: string | null;
  waterRequestId: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fieldId: string;
  fieldName?: string | null;
  cropId?: string | null;
  cropName?: string | null;
  queuePosition: number;
  status: 'waiting' | 'active' | 'completed' | 'removed' | 'cancelled';
  queuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  removedAt?: string | null;
  createdAt: string;
}

export interface TubewellQueueResponse {
  active: WaterQueueEntry | null;
  waiting: WaterQueueEntry[];
  history: WaterQueueEntry[];
}

export const waterQueueApi = {
  getQueue: (tubewellId: string): Promise<TubewellQueueResponse> =>
    apiRequest({
      url: '/tubewell/water-queue',
      method: 'GET',
      params: { tubewellId },
    }),

  moveUp: (id: string): Promise<{ success: boolean }> =>
    apiRequest({ url: `/tubewell/water-queue/${id}/move-up`, method: 'POST' }),

  moveDown: (id: string): Promise<{ success: boolean }> =>
    apiRequest({ url: `/tubewell/water-queue/${id}/move-down`, method: 'POST' }),

  moveToStart: (id: string): Promise<{ success: boolean }> =>
    apiRequest({ url: `/tubewell/water-queue/${id}/move-to-start`, method: 'POST' }),

  moveToEnd: (id: string): Promise<{ success: boolean }> =>
    apiRequest({ url: `/tubewell/water-queue/${id}/move-to-end`, method: 'POST' }),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiRequest({ url: `/tubewell/water-queue/${id}/remove`, method: 'POST' }),
};
