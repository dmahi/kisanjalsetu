import { apiRequest } from './client';

export interface WaterRequest {
  id: string;
  tubewellId: string;
  tubewellName?: string | null;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fieldId: string;
  fieldName?: string | null;
  cropId?: string | null;
  cropName?: string | null;
  requestedDurationMinutes: number;
  actualDurationMinutes?: number | null;
  finalAmountPaise?: number | null;
  requestedDate?: string | null;
  preferredStartTime?: string | null;
  preferredEndTime?: string | null;
  note?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  rejectionReason?: string | null;
  pendingBalancePaise?: number;
  pendingBalanceRupees?: number;
  queuePosition?: number | null;
  queueStatus?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface CreateWaterRequestPayload {
  tubewellId: string;
  fieldId: string;
  cropId?: string;
  cropName?: string;
  requestedDurationMinutes: number;
  requestedDate?: string;
  preferredStartTime?: string;
  preferredEndTime?: string;
  note?: string;
}

export const waterRequestApi = {
  create: (payload: CreateWaterRequestPayload): Promise<WaterRequest> =>
    apiRequest({ url: '/customer/water-requests', method: 'POST', data: payload }),

  listForCustomer: (tubewellId?: string, status?: string): Promise<WaterRequest[]> =>
    apiRequest({
      url: '/customer/water-requests',
      method: 'GET',
      params: { tubewellId, status },
    }),

  cancel: (id: string): Promise<WaterRequest> =>
    apiRequest({ url: `/customer/water-requests/${id}/cancel`, method: 'POST' }),

  listForOwner: (tubewellId: string, status?: string): Promise<WaterRequest[]> =>
    apiRequest({
      url: '/tubewell/water-requests',
      method: 'GET',
      params: { tubewellId, status },
    }),

  accept: (id: string): Promise<{ request: WaterRequest; queuePosition: number }> =>
    apiRequest({ url: `/tubewell/water-requests/${id}/accept`, method: 'POST' }),

  reject: (id: string, rejectionReason?: string): Promise<WaterRequest> =>
    apiRequest({
      url: `/tubewell/water-requests/${id}/reject`,
      method: 'POST',
      data: { rejectionReason },
    }),
};
