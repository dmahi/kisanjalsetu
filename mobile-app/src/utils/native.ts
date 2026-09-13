import { StatusBar, Style } from '@capacitor/status-bar';
import { Share } from '@capacitor/share';
import { Dialog } from '@capacitor/dialog';
import { SplashScreen } from '@capacitor/splash-screen';
import { triggerHaptic, triggerHapticNotification } from './haptics';

/**
 * Configure native mobile status bar color & appearance
 */
export async function initNativeStatusBar(): Promise<void> {
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a4f8a' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* Safe ignore when running in web browser */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* Safe ignore */
  }
}

/**
 * Open native OS share sheet or fallback to WhatsApp / Web Share
 */
export async function shareWaterReceipt(data: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  void triggerHaptic('medium');
  try {
    const canShareResult = await Share.canShare();
    if (canShareResult.value) {
      await Share.share({
        title: data.title,
        text: data.text,
        url: data.url,
        dialogTitle: 'Share Water Receipt / 📲 व्हाट्सएप शेयर',
      });
      return true;
    }
  } catch {
    /* Fallback if user cancels or native share is unavailable */
  }

  /* Web Share API fallback */
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return true;
    } catch {
      /* ignore */
    }
  }

  /* WhatsApp Direct fallback link */
  const encodedText = encodeURIComponent(`${data.title}\n\n${data.text}${data.url ? `\n${data.url}` : ''}`);
  window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  return true;
}

/**
 * Show native mobile confirmation dialog
 */
export async function confirmNativeAction(options: {
  title: string;
  message: string;
  okButtonTitle?: string;
  cancelButtonTitle?: string;
}): Promise<boolean> {
  void triggerHapticNotification('warning');
  try {
    const result = await Dialog.confirm({
      title: options.title,
      message: options.message,
      okButtonTitle: options.okButtonTitle ?? 'Confirm',
      cancelButtonTitle: options.cancelButtonTitle ?? 'Cancel',
    });
    return result.value;
  } catch {
    return window.confirm(`${options.title}\n\n${options.message}`);
  }
}
