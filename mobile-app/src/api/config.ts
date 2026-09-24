export const isCapacitorNative = (): boolean =>
  typeof (window as any)?.Capacitor !== 'undefined' &&
  !!(window as any)?.Capacitor?.isNativePlatform?.();

// Render backend supports WebSockets/socket.io (Vercel serverless does not),
// which the real-time start/stop + alert ringtone depend on.
const DEFAULT_HOST = 'https://kisanjalsetu-backend.onrender.com/api';

export const API_BASE_URL = (import.meta.env?.VITE_API_URL as string | undefined) || DEFAULT_HOST;