'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type BadgeQrScannerProps = {
  onScan: (raw: string) => void;
  disabled?: boolean;
};

/**
 * Scanner caméra QR pour le check-in. Ignore les doublons immédiats.
 */
export default function BadgeQrScanner({ onScan, disabled }: BadgeQrScannerProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {
        /* ignore */
      }
    }
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode('jsan-badge-qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decoded) => {
          const value = decoded.trim();
          if (!value) return;
          const now = Date.now();
          if (value === lastScanRef.current.value && now - lastScanRef.current.at < 3500) return;
          lastScanRef.current = { value, at: now };
          onScanRef.current(value);
        },
        () => undefined
      );
      setActive(true);
    } catch (e) {
      setActive(false);
      setError(
        e instanceof Error
          ? e.message
          : 'Caméra indisponible. Autorisez l’accès ou saisissez le code manuellement.'
      );
      await stop();
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  useEffect(() => {
    if (disabled && active) void stop();
  }, [disabled, active, stop]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Scanner caméra</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Pointez le QR du badge. Un bip / validation suit automatiquement.
          </div>
        </div>
        {!active ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void start()}
            style={{
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 14px',
              fontWeight: 600,
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            Activer la caméra
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stop()}
            style={{
              background: 'transparent',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: '9px 14px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Arrêter
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div
        id="jsan-badge-qr-reader"
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          borderRadius: 12,
          overflow: 'hidden',
          display: active ? 'block' : 'none',
          background: '#0f172a',
        }}
      />
      {!active && !error && (
        <div
          style={{
            height: 160,
            borderRadius: 12,
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 13,
          }}
        >
          Caméra en veille
        </div>
      )}
    </div>
  );
}
