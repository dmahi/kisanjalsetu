import { apiRequest } from './client';

export interface Crop {
  id: string;
  name: string;
  status: string;
}

export interface Field {
  id: string;
  customerId: string;
  name: string;
  area: number;
  areaUnit?: string;
  location?: string;
  notes?: string;
  status: string;
}

export interface ApiNotification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const cropsApi = {
  list: (): Promise<Crop[]> => apiRequest({ url: '/crops', method: 'GET' }),
};

export const fieldsApi = {
  list: (): Promise<Field[]> => apiRequest({ url: '/fields', method: 'GET' }),
  create: (data: { name: string; area?: number; areaUnit?: string; location?: string; notes?: string }): Promise<Field> =>
    apiRequest({ url: '/fields', method: 'POST', data }),
  update: (id: string, data: Record<string, unknown>): Promise<Field> =>
    apiRequest({ url: `/fields/${id}`, method: 'PATCH', data }),
  remove: (id: string): Promise<void> => apiRequest({ url: `/fields/${id}`, method: 'DELETE' }),
};

export interface RegisterDeviceTokenData {
  token: string;
  platform?: string;
  deviceId?: string;
  deviceType?: string;
  appVersion?: string;
}

export const notificationsApi = {
  list: (limit = 50): Promise<ApiNotification[]> =>
    apiRequest({ url: '/notifications', method: 'GET', params: { limit } }),
  unreadCount: (): Promise<{ count: number }> =>
    apiRequest({ url: '/notifications/unread-count', method: 'GET' }),
  markRead: (id: string): Promise<{ read: boolean }> =>
    apiRequest({ url: `/notifications/${id}/read`, method: 'POST' }),
  markAllRead: (): Promise<{ read: boolean }> =>
    apiRequest({ url: '/notifications/read-all', method: 'POST' }),
  registerDeviceToken: (data: RegisterDeviceTokenData): Promise<{ registered: boolean }> =>
    apiRequest({ url: '/device/fcm-token', method: 'POST', data: { platform: 'fcm', ...data } }),
  logoutDeviceToken: (token: string): Promise<{ loggedOut: boolean }> =>
    apiRequest({ url: '/device/fcm-token/logout', method: 'POST', data: { token } }),
  removeDeviceToken: (token: string): Promise<{ removed: boolean }> =>
    apiRequest({ url: '/device/fcm-token/remove', method: 'POST', data: { token } }),
};