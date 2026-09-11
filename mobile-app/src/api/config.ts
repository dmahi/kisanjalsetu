export const isCapacitorNative = (): boolean =>
  typeof (window as any)?.Capacitor !== 'undefined' &&
  !!(window as any)?.Capacitor?.isNativePlatform?.();

const DEFAULT_HOST = isCapacitorNative() && /android/i.test(navigator.userAgent)
  ? 'https://backend-olive-iota-17.vercel.app/api'
  : 'https://kisanjalsetu-backend.onrender.com/api';

export const API_BASE_URL = (import.meta.env?.VITE_API_URL as string | undefined) || DEFAULT_HOST;