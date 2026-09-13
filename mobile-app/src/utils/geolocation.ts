import { Geolocation } from '@capacitor/geolocation';
import { triggerHaptic } from './haptics';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

/**
 * Get current device GPS location with Capacitor Geolocation & browser fallback
 */
export async function getCurrentCoordinates(): Promise<LocationCoords | null> {
  void triggerHaptic('light');
  try {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      await Geolocation.requestPermissions();
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch {
    /* Fallback to standard web geolocation */
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          () => resolve(null),
          { timeout: 10000 },
        );
      });
    }
    return null;
  }
}

/**
 * Calculate distance in kilometers between two GPS coordinates (Haversine formula)
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Format distance value to display badge text e.g. "📍 1.2 km away"
 */
export function formatDistanceBadge(distKm: number | null): string | null {
  if (distKm === null || isNaN(distKm)) return null;
  if (distKm < 0.1) return '📍 Right here (<100m)';
  if (distKm < 1) return `📍 ${Math.round(distKm * 1000)}m away`;
  return `📍 ${distKm.toFixed(1)} km away`;
}
