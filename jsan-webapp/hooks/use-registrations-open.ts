'use client';

import { useEffect, useState } from 'react';

/** null = chargement en cours ; par défaut on considère ouvert (fail-open). */
export function useRegistrationsOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/registrations/status', { cache: 'no-store' })
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
