/**
 * Client-Side Image Compressor for Low-Bandwidth 3G/4G Networks
 * Scales down high-res camera captures (e.g. 12MP/4MB) to max 1024px width/height
 * and compresses to WebP / JPEG under 80-120KB before transmission.
 */

export interface CompressionResult {
  base64: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: string;
}

export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.75
): Promise<CompressionResult> {
  const originalSizeBytes = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Scale proportionally if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to obtain canvas 2D rendering context'));
          return;
        }

        // Draw image with smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern WebP, fallback to JPEG
        let mimeType = 'image/webp';
        let base64 = canvas.toDataURL('image/webp', quality);

        if (!base64.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        // Approximate size from base64
        const head = base64.indexOf(',') + 1;
        const compressedSizeBytes = Math.round((base64.length - head) * 0.75);
        const ratio = ((1 - compressedSizeBytes / originalSizeBytes) * 100).toFixed(1) + '%';

        resolve({
          base64,
          mimeType,
          originalSizeBytes,
          compressedSizeBytes,
          compressionRatio: ratio,
        });
      };

      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file buffer'));
    reader.readAsDataURL(file);
  });
}
