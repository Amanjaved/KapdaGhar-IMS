import { compressImage } from '@/lib/utils/imageCompression';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export const imageService = {
  async processAndUploadImage(
    file: File,
    productId: string,
    onProgress?: (percent: number) => void,
    onStatusChange?: (status: string) => void
  ): Promise<{ imageUrl: string; sizeKb: number }> {
    if (onProgress) onProgress(20);

    // Step 1: Compress on client canvas to WebP (with automatic HEIC -> JPEG normalization)
    const compressed = await compressImage(file, 1200, 0.8, onStatusChange);
    if (onProgress) onProgress(60);

    if (onStatusChange) onStatusChange('Uploading optimized image...');

    // Step 2: Cloud Storage if configured & online
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const filePath = `products/${productId}-${Date.now()}.webp`;
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, compressed.blob, {
              contentType: 'image/webp',
              upsert: true,
            });

          if (!uploadError) {
            const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
            if (data?.publicUrl) {
              if (onProgress) onProgress(100);
              return { imageUrl: data.publicUrl, sizeKb: compressed.compressedSizeKb };
            }
          } else {
            console.warn('Supabase storage upload error, saving local dataUrl:', uploadError);
          }
        }
      } catch (err) {
        console.warn('Supabase storage unavailable, falling back to local dataUrl:', err);
      }
    }

    // Step 3: Local base64 dataUrl fallback
    if (onProgress) onProgress(100);
    return {
      imageUrl: compressed.dataUrl,
      sizeKb: compressed.compressedSizeKb,
    };
  },
};
