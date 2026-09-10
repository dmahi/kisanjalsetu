import { apiRequest } from './client';

export interface LedgerEntry {
  date: string;
  type: 'water' | 'payment';
  description: string;
  amountPaise: number;
  balancePaise: number;
  refId?: string;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  totals: {
    totalBilledPaise: number;
    totalPaidPaise: number;
    balancePaise: number;
  };
}

export interface Payment {
  id: string;
  tubewellId: string;
  customerId: string;
  amountPaise: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  status: string;
  source?: string;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  tubewellId: string;
  customerId: string;
  amountPaise: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  customerName?: string;
}

export interface DashboardTotals {
  tubewell?: {
    id: string;
    name: string;
    ratePerHour: number;
  };
  totals: {
    totalMinutes: number;
    totalBilledPaise: number;
    totalPaidPaise: number;
    totalPendingPaise: number;
  };
}

export const paymentsApi = {
  dashboard: (tubewellId: string): Promise<DashboardTotals> =>
    apiRequest({ url: '/customer/dashboard', method: 'GET', params: { tubewellId } }),

  ledger: (tubewellId?: string): Promise<LedgerResponse> =>
    apiRequest({ url: '/customer/ledger', method: 'GET', params: tubewellId ? { tubewellId } : {} }),

  myPayments: (tubewellId?: string): Promise<Payment[]> =>
    apiRequest({ url: '/customer/payments', method: 'GET', params: tubewellId ? { tubewellId } : {} }),

  myRequests: (tubewellId?: string): Promise<PaymentRequest[]> =>
    apiRequest({ url: '/customer/payment-requests', method: 'GET', params: tubewellId ? { tubewellId } : {} }),

  request: (tubewellId: string, amountPaise: number, notes?: string, idempotencyKey?: string): Promise<PaymentRequest> =>
    apiRequest({
      url: '/customer/payment-requests',
      method: 'POST',
      data: { tubewellId, amountPaise, notes, idempotencyKey },
    }),
};

export const ownerPaymentsApi = {
  list: (tubewellId: string): Promise<Payment[]> =>
    apiRequest({ url: '/tubewell/payments', method: 'GET', params: { tubewellId } }),

  record: (
    tubewellId: string,
    customerId: string,
    amountPaise: number,
    paymentMethod?: string,
    referenceNumber?: string,
    notes?: string,
    idempotencyKey?: string,
  ): Promise<Payment> =>
    apiRequest({
      url: '/tubewell/payments/record',
      method: 'POST',
      data: { tubewellId, customerId, amountPaise, paymentMethod, referenceNumber, notes, idempotencyKey },
    }),

  requests: (tubewellId: string, status?: string): Promise<PaymentRequest[]> =>
    apiRequest({ url: '/tubewell/payment-requests', method: 'GET', params: { tubewellId, status } }),

  approveRequest: (id: string): Promise<{ message: string }> =>
    apiRequest({ url: `/tubewell/payment-requests/${id}/approve`, method: 'POST' }),

  rejectRequest: (id: string): Promise<{ message: string }> =>
    apiRequest({ url: `/tubewell/payment-requests/${id}/reject`, method: 'POST' }),
};