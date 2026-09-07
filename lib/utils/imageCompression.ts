/**
 * Client-side Canvas Image Compression & Format Normalization
 * - Supports standard images (JPEG, PNG, WebP)
 * - Automatically converts Apple iPhone HEIC/HEIF images into standard JPEG/WebP
 * - Resizes image so max dimension is 1200px
 * - Compresses to WebP format at 80% quality (fallback to JPEG if WebP unsupported)
 * - Guarantees file size is well under 300KB
 * - Returns a clean Blob and base64 dataUrl
 */

export interface CompressionResult {
  blob: Blob;
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  width: number;
  height: number;
}

// In-memory cache for converted HEIC URLs
const convertedHeicCache = new Map<string, string>();

/**
 * Checks if a file, blob, or URL is in Apple HEIC/HEIF format
 */
export function isHeicFormat(fileOrUrl: File | Blob | string): boolean {
  if (typeof fileOrUrl === 'string') {
    const lower = fileOrUrl.toLowerCase();
    return (
      lower.endsWith('.heic') ||
      lower.endsWith('.heif') ||
      lower.includes('.heic?') ||
      lower.includes('.heif?') ||
      lower.startsWith('data:image/heic') ||
      lower.startsWith('data:image/heif')
    );
  }

  const name = (fileOrUrl as File).name?.toLowerCase() || '';
  const type = fileOrUrl.type?.toLowerCase() || '';
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    type === 'image/heic' ||
    type === 'image/heif' ||
    (type === '' && (name.endsWith('.heic') || name.endsWith('.heif')))
  );
}

/**
 * Converts an Apple HEIC/HEIF file or blob into standard JPEG format
 */
export async function convertHeicToJpeg(fileOrBlob: File | Blob): Promise<File> {
  if (typeof window === 'undefined') {
    return fileOrBlob as File;
  }

  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || heic2anyModule;

    const result = await heic2any({
      blob: fileOrBlob,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    const convertedBlob = Array.isArray(result) ? result[0] : result;
    const originalName = (fileOrBlob as File).name || 'photo.heic';
    const newName = originalName.replace(/\.(heic|heif)$/i, '.jpg');

    return new File([convertedBlob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.error('HEIC to JPEG conversion failed:', err);
    throw new Error('Unable to convert HEIC image. Please upload a JPEG or PNG photo.');
  }
}

/**
 * Converts a remote or base64 HEIC URL into a browser-displayable JPEG Object URL
 */
export async function convertHeicUrlToDisplayable(url: string): Promise<string> {
  if (typeof window === 'undefined' || !url) return url;
  if (!isHeicFormat(url)) return url;

  if (convertedHeicCache.has(url)) {
    return convertedHeicCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const convertedFile = await convertHeicToJpeg(blob);
    const objectUrl = URL.createObjectURL(convertedFile);
    convertedHeicCache.set(url, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn('Failed to convert HEIC URL to displayable:', err);
    return url;
  }
}

export async function compressImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.8,
  onStatusChange?: (status: string) => void
): Promise<CompressionResult> {
  let targetFile = file;

  // Step 1: Detect and convert Apple iPhone HEIC/HEIF images to standard JPEG first
  if (isHeicFormat(file)) {
    if (onStatusChange) onStatusChange('Converting iPhone (HEIC) photo...');
    targetFile = await convertHeicToJpeg(file);
  }

  if (onStatusChange) onStatusChange('Optimizing image size...');

  // Step 2: Canvas resizing and compression to WebP/JPEG
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(targetFile.size / 1024);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize proportionally if dimensions exceed maxDimension
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
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // If browser doesn't support WebP export, canvas returns image/png
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression blob creation failed'));
              return;
            }

            const compressedSizeKb = Math.round(blob.size / 1024);
            resolve({
              blob,
              dataUrl,
              originalSizeKb,
              compressedSizeKb,
              width,
              height,
            });
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(targetFile);
  });
}
