/** Fallback emoji shown when the user has not uploaded a profile photo. */
export function avatarEmoji(role?: string): string {
  return role === 'farmer' ? '👨‍🌾' : '⚡';
}

/** Crop to a centered square and downscale into a small JPEG data-URL so the
 *  profile photo stays tiny when stored on the user document. */
export async function dataUrlToSquare(dataUrl: string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const side = Math.min(img.width, img.height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch (err) {
        reject(err as Error);
      }
    };
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = dataUrl;
  });
}