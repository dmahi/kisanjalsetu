import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'https://kisanjalsetu-backend.onrender.com/api';

const TOKEN_KEY = 'waterapp.admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(v: string | null): void {
  if (v) localStorage.setItem(TOKEN_KEY, v);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface Envelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export async function api<T>(config: AxiosRequestConfig): Promise<T> {
  const token = getToken();
  const res = await axios.request<Envelope<T>>({
    ...config,
    baseURL: API_BASE_URL,
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.headers || {}),
    },
  });
  return res.data.data;
}

export function errMsg(error: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  return fallback;
}

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export const authApi = {
  sendOtp: (phone: string) => api<{ message: string }>({ url: '/auth/send-otp', method: 'POST', data: { phone } }),
  verifyOtp: (phone: string, code: string, role: 'admin', name?: string) =>
    api<{ token: string; user: AuthUser }>({ url: '/auth/verify-otp', method: 'POST', data: { phone, code, role, name } }),
};

export interface AdminStats {
  farmers: number;
  owners: number;
  tubewells: number;
  totalSessions: number;
  totalHours: number;
  totalBilledPaise: number;
  totalCollectedPaise: number;
  totalPendingPaise: number;
  paymentCount: number;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  status: string;
  phoneVerifiedAt?: string | null;
  createdAt?: string;
}

export interface AdminTubewell {
  id: string;
  name: string;
  code: string;
  address: string;
  village?: string | null;
  status: string;
  ownerId?: string;
  ratePerHour: number;
  createdAt?: string;
}

export interface AdminSession {
  id: string;
  tubewellId: string;
  customerId: string;
  startDatetime: string;
  endDatetime?: string | null;
  durationMinutes?: number | null;
  finalAmountPaise: number;
  status: string;
  paymentStatus: string;
}

export interface AdminPayment {
  id: string;
  tubewellId: string;
  customerId: string;
  amountPaise: number;
  paymentMethod: string;
  status: string;
  source?: string;
  createdAt?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  createdAt: string;
}

export const adminApi = {
  stats: () => api<AdminStats>({ url: '/admin/stats', method: 'GET' }),

  users: (params: { role?: string; search?: string; page?: number; limit?: number }) =>
    api<{ items: AdminUser[]; total: number; page: number; limit: number }>({ url: '/admin/users', method: 'GET', params }),

  suspendUser: (id: string) => api<{ message: string }>({ url: `/admin/users/${id}/suspend`, method: 'POST' }),
  activateUser: (id: string) => api<{ message: string }>({ url: `/admin/users/${id}/activate`, method: 'POST' }),

  tubewells: (params: { search?: string; limit?: number }) =>
    api<AdminTubewell[]>({ url: '/admin/tubewells', method: 'GET', params }),
  suspendTubewell: (id: string) => api<{ message: string }>({ url: `/admin/tubewells/${id}/suspend`, method: 'POST' }),
  activateTubewell: (id: string) => api<{ message: string }>({ url: `/admin/tubewells/${id}/activate`, method: 'POST' }),

  sessions: (params: { limit?: number }) => api<AdminSession[]>({ url: '/admin/sessions', method: 'GET', params }),
  payments: (params: { limit?: number }) => api<AdminPayment[]>({ url: '/admin/payments', method: 'GET', params }),

  activityLogs: (params: { entityType?: string; entityId?: string; limit?: number }) =>
    api<ActivityLog[]>({ url: '/admin/activity-logs', method: 'GET', params }),
};