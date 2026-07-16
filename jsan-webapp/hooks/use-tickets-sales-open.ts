'use client';

import { useEffect, useState } from 'react';

/** null = chargement ; fail-open (true) si l’API échoue. */
export function useTicketsSalesOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/tickets-sales/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { open: true }))
      .then((data: { open?: boolean }) => {
        if (!cancelled) setOpen(data.open !== false);
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return open;
}

export function useTicketsSalesStatus(): { open: boolean | null; message: string } {
  const [open, setOpen] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/tickets-sales/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { open: true, message: '' }))
      .then((data: { open?: boolean; message?: string }) => {
        if (cancelled) return;
        setOpen(data.open !== false);
        setMessage((data.message ?? '').trim());
      })
      .catch(() => {
        if (!cancelled) {
          setOpen(true);
          setMessage('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { open, message };
}
