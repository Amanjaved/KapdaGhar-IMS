'use client';

import React, { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { isHeicFormat, convertHeicUrlToDisplayable } from '@/lib/utils/imageCompression';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fallbackIcon?: React.ReactNode;
}

export function ProductImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  loading = 'lazy',
  fallbackIcon,
}: ProductImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(src || null);
  const [hasError, setHasError] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    setHasError(false);

    if (!src) {
      setDisplaySrc(null);
      return;
    }

    if (isHeicFormat(src)) {
      let isMounted = true;
      setIsConverting(true);

      convertHeicUrlToDisplayable(src)
        .then((convertedUrl) => {
          if (isMounted) {
            setDisplaySrc(convertedUrl);
            setIsConverting(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setHasError(true);
            setIsConverting(false);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setDisplaySrc(src);
      setIsConverting(false);
    }
  }, [src]);

  if (!displaySrc || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600 bg-slate-100/70 dark:bg-[#0b0f19]">
        {fallbackIcon || <Tag className="w-5 h-5 stroke-[1.5]" />}
      </div>
    );
  }

  if (isConverting) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] animate-pulse">
        <span className="text-[10px] text-slate-400 font-medium">Loading photo...</span>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setHasError(true)}
    />
  );
}
