export const isCapacitorNative = (): boolean =>
  typeof (window as any)?.Capacitor !== 'undefined' &&
  !!(window as any)?.Capacitor?.isNativePlatform?.();

const DEFAULT_HOST = isCapacitorNative() && /android/i.test(navigator.userAgent)
  ? 'http://10.0.2.2:2345/api'
  : 'http://localhost:2345/api';

export const API_BASE_URL = (import.meta.env?.VITE_API_URL as string | undefined) || DEFAULT_HOST;