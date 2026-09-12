import { apiRequest } from './client';

export interface WaterSession {
  id: string;
  tubewellId: string;
  customerId: string;
  fieldId?: string | null;
  cropId?: string | null;
  cropName?: string;
  startDatetime: string;
  endDatetime?: string | null;
  durationMinutes?: number | null;
  ratePerHourPaise: number;
  grossAmountPaise: number;
  discountAmountPaise: number;
  discountType?: string | null;
  discountValue?: number | null;
  discountReason?: string | null;
  finalAmountPaise: number;
  status: 'running' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  paidAmountPaise: number;
  createdAt: string;
  customerName?: string;
  fieldName?: string;
}

export interface StartSessionPayload {
  tubewellId: string;
  customerId: string;
  fieldId?: string;
  cropId?: string;
  cropName?: string;
  startDatetime?: string;
  idempotencyKey?: string;
  waterRequestId?: string;
  waterQueueEntryId?: string;
}

export interface ManualSessionPayload {
  tubewellId: string;
  customerId: string;
  fieldId?: string;
  cropId?: string;
  cropName?: string;
  startDatetime: string;
  endDatetime: string;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  discountReason?: string;
  idempotencyKey?: string;
}

export const waterSessionApi = {
  start: (payload: StartSessionPayload): Promise<WaterSession> =>
    apiRequest({ url: '/tubewell/water-sessions/start', method: 'POST', data: payload }),

  stop: (id: string, endDatetime?: string): Promise<WaterSession> =>
    apiRequest({ url: `/tubewell/water-sessions/${id}/stop`, method: 'POST', data: { endDatetime } }),

  manual: (payload: ManualSessionPayload): Promise<WaterSession> =>
    apiRequest({ url: '/tubewell/water-sessions/manual', method: 'POST', data: payload }),

  update: (id: string, data: Record<string, unknown>): Promise<WaterSession> =>
    apiRequest({ url: `/tubewell/water-sessions/${id}`, method: 'PUT', data }),

  cancel: (id: string): Promise<WaterSession> =>
    apiRequest({ url: `/tubewell/water-sessions/${id}/cancel`, method: 'POST' }),

  listForOwner: (tubewellId: string, params?: Record<string, unknown>): Promise<WaterSession[]> =>
    apiRequest({ url: '/tubewell/water-sessions', method: 'GET', params: { tubewellId, ...params } }),

  listForCustomer: (params?: Record<string, unknown>): Promise<WaterSession[]> =>
    apiRequest({ url: '/customer/water-sessions', method: 'GET', params }),

  customerStart: (payload: {
    tubewellId: string;
    fieldId?: string;
    cropId?: string;
    cropName?: string;
    idempotencyKey?: string;
  }): Promise<WaterSession> =>
    apiRequest({ url: '/customer/water-sessions/start', method: 'POST', data: payload }),

  customerStop: (id: string, endDatetime?: string): Promise<WaterSession> =>
    apiRequest({ url: `/customer/water-sessions/${id}/stop`, method: 'POST', data: { endDatetime } }),
};