import { apiRequest } from './client';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'farmer' | 'tubewell_owner' | 'operator';
  status: string;
  email?: string | null;
  profileImage?: string | null;
}

export const authApi = {
  sendOtp: (phone: string): Promise<{ message: string; resent: boolean }> =>
    apiRequest({ url: '/auth/send-otp', method: 'POST', data: { phone } }),

  verifyOtp: (
    phone: string,
    code: string,
    name?: string,
  ): Promise<{ token: string; user: User }> =>
    apiRequest({ url: '/auth/verify-otp', method: 'POST', data: { phone, code, name } }),

  logout: (): Promise<{ message: string }> =>
    apiRequest({ url: '/auth/logout', method: 'POST' }),

  me: (): Promise<User> => apiRequest({ url: '/users/me', method: 'GET' }),

  updateProfile: (data: { name?: string; email?: string; profileImage?: string }): Promise<User> =>
    apiRequest({ url: '/users/me', method: 'PATCH', data }),
};