'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

type TicketCardImageProps = {
  src: string | null | undefined;
  alt: string;
  /** Hauteur du cadre (px). */
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Image billet optimisée (next/image). Fallback placeholder si src vide ;
 * blob: / data: restent en <img> natif (aperçu upload).
 */
export default function TicketCardImage({
  src,
  alt,
  height = 160,
  sizes = '(max-width: 640px) 100vw, 320px',
  priority = false,
  className,
  style,
}: TicketCardImageProps) {
  const url = (src ?? '').trim();
  const isLocalPreview = url.startsWith('blob:') || url.startsWith('data:');

  if (!url) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height,
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 12,
          ...style,
        }}
      >
        Photo
      </div>
    );
  }

  if (isLocalPreview) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className={className}
        style={{ width: '100%', height, objectFit: 'cover', display: 'block', ...style }}
      />
    );
  }

  let unoptimized = false;
  try {
    const host = new URL(url).hostname;
    unoptimized = !(host === 'images.unsplash.com' || host.endsWith('.supabase.co'));
  } catch {
    unoptimized = true;
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height, overflow: 'hidden', ...style }}
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}
