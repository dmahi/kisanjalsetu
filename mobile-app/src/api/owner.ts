import { apiRequest } from './client';
import type { User } from './auth';

export interface BecomeOwnerDto {
  name: string;
  type: 'motor_pump' | 'submersible_pump';
  ratePerHourPaise: number;
  address: string;
  village?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  profileImage?: string;
}

export interface BecomeOwnerResult {
  token: string;
  user: User;
  tubewell: {
    id: string;
    name: string;
    code: string;
    type: string | null;
    images: string[];
    settings: { ratePerHourPaise: number; ratePerHour: number };
  };
  message: string;
}

export const ownerApi = {
  becomeOwner: (data: BecomeOwnerDto): Promise<BecomeOwnerResult> =>
    apiRequest({ url: '/tubewells/become-owner', method: 'POST', data }),
};

export interface RunningSession {
  id: string;
  customerId: string;
  customerName?: string | null;
  startDatetime: string;
  elapsedMinutes: number;
  ratePerHour: number;
  warning?: string | null;
}

export interface OwnerDashboard {
  today: {
    totalMinutes: number;
    totalHours: number;
    totalBilledPaise: number;
    totalCollectedPaise: number;
    totalPendingPaise: number;
    customers: number;
  };
  running: RunningSession | null;
}

export interface ReportSummary {
  totalCustomers: number;
  totalMinutes: number;
  totalHours: number;
  totalBilledPaise: number;
  totalCollectedPaise: number;
  totalPendingPaise: number;
  sessionCount: number;
}

export interface FullReport extends ReportSummary {
  amounts?: { totalBilled: number; totalCollected: number; totalPending: number };
}

export const ownerDashboardApi = {
  dashboard: (tubewellId: string): Promise<OwnerDashboard> =>
    apiRequest({ url: '/tubewell/dashboard', method: 'GET', params: { tubewellId } }),

  summary: (tubewellId: string): Promise<{ daily: ReportSummary; monthly: ReportSummary; yearly: ReportSummary }> =>
    apiRequest({ url: '/tubewell/reports/summary', method: 'GET', params: { tubewellId } }),

  report: (
    tubewellId: string,
    period: 'today' | 'week' | 'month' | 'year' | 'custom',
    from?: string,
    to?: string,
  ): Promise<FullReport> =>
    apiRequest({ url: '/tubewell/reports', method: 'GET', params: { tubewellId, period, from, to } }),

  warn: (tubewellId: string): Promise<{ warned: boolean; warning?: string; sessionId?: string }> =>
    apiRequest({ url: '/tubewell/sessions/warn', method: 'POST', data: { tubewellId } }),

  exportCsvUrl: (tubewellId: string, from?: string, to?: string): string => {
    const params = new URLSearchParams({ tubewellId });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `/tubewell/reports/export.csv?${params.toString()}`;
  },
};