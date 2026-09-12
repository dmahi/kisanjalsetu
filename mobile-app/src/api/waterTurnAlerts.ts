import { apiRequest } from './client';

export type WaterTurnAlertStatus =
  | 'pending'
  | 'sent'
  | 'acknowledged'
  | 'ready'
  | 'not_ready'
  | 'no_response'
  | 'cancelled';

export interface WaterTurnAlert {
  id: string;
  tubewellId: string;
  tubewellName?: string | null;
  waterQueueEntryId: string;
  waterRequestId?: string | null;
  waterSessionId?: string | null;
  targetCustomerId: string;
  farmerName?: string | null;
  farmerPhone?: string | null;
  fieldId?: string | null;
  fieldName?: string | null;
  cropId?: string | null;
  cropName?: string | null;
  estimatedRemainingMinutes: number;
  attemptNumber: number;
  maxAttempts: number;
  status: WaterTurnAlertStatus;
  sentAt?: string | null;
  responseDeadlineAt?: string | null;
  respondedAt?: string | null;
  response?: 'ready' | 'not_ready' | null;
  responseNote?: string | null;
  noResponseAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  remainingSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface NextQueueEntry {
  id: string;
  waterRequestId: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fieldId?: string | null;
  fieldName?: string | null;
  cropId?: string | null;
  cropName?: string | null;
  queuePosition: number;
}

export interface NextForTubewell {
  next: NextQueueEntry | null;
  alert: WaterTurnAlert | null;
}

export const waterTurnAlertsApi = {
  create: (payload: { tubewellId: string; estimatedRemainingMinutes?: number }): Promise<WaterTurnAlert> =>
    apiRequest({ url: '/water-turn-alerts', method: 'POST', data: payload }),

  get: (id: string): Promise<WaterTurnAlert> =>
    apiRequest({ url: `/water-turn-alerts/${id}`, method: 'GET' }),

  respond: (id: string, payload: { response: 'ready' | 'not_ready'; note?: string }): Promise<WaterTurnAlert> =>
    apiRequest({ url: `/water-turn-alerts/${id}/response`, method: 'POST', data: payload }),

  retry: (id: string): Promise<WaterTurnAlert> =>
    apiRequest({ url: `/water-turn-alerts/${id}/retry`, method: 'POST' }),

  cancel: (id: string, reason?: string): Promise<WaterTurnAlert> =>
    apiRequest({ url: `/water-turn-alerts/${id}/cancel`, method: 'POST', data: reason ? { reason } : {} }),

  listForOwner: (tubewellId: string): Promise<WaterTurnAlert[]> =>
    apiRequest({ url: '/tubewell/water-turn-alerts', method: 'GET', params: { tubewellId } }),

  listForFarmer: (tubewellId?: string): Promise<WaterTurnAlert[]> =>
    apiRequest({ url: '/customer/water-turn-alerts', method: 'GET', params: tubewellId ? { tubewellId } : {} }),

  next: (tubewellId: string): Promise<NextForTubewell> =>
    apiRequest({ url: `/tubewell/water-queue/${tubewellId}/next`, method: 'GET' }),
};