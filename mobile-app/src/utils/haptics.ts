import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Trigger physical haptic impact vibration on mobile devices
 */
export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  try {
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light });
  } catch {
    /* Fallback on desktop browsers or non-supported devices */
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      const msMap = { light: 10, medium: 25, heavy: 45 };
      navigator.vibrate(msMap[style] ?? 15);
    }
  }
}

/**
 * Trigger haptic notification pattern (success, warning, error)
 */
export async function triggerHapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  try {
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: map[type] ?? NotificationType.Success });
  } catch {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      const patternMap = {
        success: [15, 50, 15],
        warning: [30, 40, 30],
        error: [50, 50, 50],
      };
      navigator.vibrate(patternMap[type] ?? 20);
    }
  }
}

/**
 * Trigger haptic selection tick (e.g. tab switch, dropdown change)
 */
export async function triggerHapticSelection(): Promise<void> {
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
  } catch {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }
}
