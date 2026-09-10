import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

/** Base origin (no /api suffix) for serving uploaded files. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Turn a stored server path like "/uploads/x.png" into an absolute URL. */
export function toFileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Upload an image blob; returns the stored server path (/uploads/...). */
export async function uploadImage(file: Blob, filename = 'photo.jpg'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, filename);
  const token = await getEffectiveToken();
  const res = await client.request<ApiEnvelope<{ path: string }>>({
    url: '/uploads/image',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.data.data.path;
}

/** All API traffic goes through this instance. */
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'waterapp.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Async-capable token provider (used by Capacitor Preferences in native mode). */
let asyncTokenProvider: (() => Promise<string | null>) | null = null;
export function setAsyncTokenProvider(fn: () => Promise<string | null>): void {
  asyncTokenProvider = fn;
}
export async function getEffectiveToken(): Promise<string | null> {
  if (asyncTokenProvider) return asyncTokenProvider();
  return getToken();
}

/** Perform an authed call and unwrap the { success, message, data } envelope. */
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const token = await getEffectiveToken();
  const res = await client.request<ApiEnvelope<T>>({
    ...config,
    headers: {
      ...(config.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.data.data;
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiEnvelope>;
    if (ax.response?.status === 401) return 'Session expired. Please login again.';
    return ax.response?.data?.message || ax.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default client;