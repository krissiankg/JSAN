'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type BadgeQrCodeProps = {
  payload: string;
  size?: number;
  alt?: string;
  className?: string;
};

/**
 * QR généré localement (pas de service tiers).
 */
export default function BadgeQrCode({
  payload,
  size = 200,
  alt = 'QR code badge',
  className,
}: BadgeQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 12,
        }}
      >
        QR…
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}
    />
  );
}
