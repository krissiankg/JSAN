"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  checkInByBadgeToken,
  fetchCheckInStats,
  formatCheckInAt,
  type CheckInResult,
} from '@/lib/check-in';

function AdminCheckInInner() {
  const { user, userRole } = useAuth();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState<{ paid: number; checkedIn: number } | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchCheckInStats(supabase));
    } catch {
      setStats(null);
    }
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) void refreshStats();
  }, [userRole, refreshStats]);

  useEffect(() => {
    const fromUrl = searchParams.get('code');
    if (fromUrl) setCode(fromUrl.replace(/^JSAN:/i, ''));
  }, [searchParams]);

  const runCheckIn = async (raw: string) => {
    if (!user) return;
    setBusy(true);
    setResult(null);
    const cleaned = raw.replace(/^JSAN:/i, '').trim();
    const res = await checkInByBadgeToken(supabase, cleaned, user.id);
    setResult(res);
    setBusy(false);
    if (res.ok) {
      setCode('');
      void refreshStats();
    }
  };

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès interdit</h2>
        <p style={{ color: '#64748b' }}>Réservé aux organisateurs.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 4px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>Check-in jour J</h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 18px' }}>
        Scannez le QR du badge (colle le contenu) ou saisissez le code court à 8 caractères.
      </p>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Billets payés</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.paid}</div>
          </div>
          <div style={{ background: '#E8F5EC', border: '1px solid #B7DFC0', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#145224' }}>Entrées validées</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#145224' }}>{stats.checkedIn}</div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runCheckIn(code);
        }}
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}
      >
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
          Code badge / QR
        </label>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="JSAN:… ou ABC12DEF"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            fontSize: 16,
            fontFamily: 'ui-monospace, Menlo, monospace',
            marginBottom: 12,
          }}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          style={{
            width: '100%',
            background: '#1B6B2E',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy || !code.trim() ? 0.6 : 1,
          }}
        >
          {busy ? 'Vérification…' : 'Valider l’entrée'}
        </button>
      </form>

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            border: `1px solid ${result.ok ? '#B7DFC0' : '#fecaca'}`,
            background: result.ok ? '#f0fdf4' : '#fef2f2',
            color: result.ok ? '#145224' : '#b91c1c',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{result.message}</div>
          {result.ticket && (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div><strong>{result.ticket.holderName}</strong></div>
              <div>{result.ticket.type_billet}</div>
              {result.ticket.checked_in_at && (
                <div>Horodatage : {formatCheckInAt(result.ticket.checked_in_at)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminCheckInPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94a3b8' }}>Chargement…</div>}>
      <AdminCheckInInner />
    </Suspense>
  );
}
