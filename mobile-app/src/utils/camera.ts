import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { triggerHaptic } from './haptics';

/**
 * Capture photo from camera or pick from gallery
 */
export async function capturePhoto(source: 'camera' | 'photos' = 'camera'): Promise<string | null> {
  void triggerHaptic('medium');
  try {
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    });
    return image.dataUrl || null;
  } catch {
    /* Fallback input file dialog for web browsers */
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }
}
