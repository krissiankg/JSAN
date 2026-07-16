"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import BadgeQrScanner from '@/components/BadgeQrScanner';
import {
  checkInByBadgeToken,
  exportCheckInHistoryCsv,
  fetchCheckInStats,
  fetchRecentCheckIns,
  formatCheckInAt,
  normalizeBadgeScanInput,
  type CheckInHistoryRow,
  type CheckInResult,
  type CheckInStats,
} from '@/lib/check-in';

const OFFLINE_QUEUE_KEY = 'jsan_checkin_offline_queue';

type OfflineQueueItem = { code: string; queuedAt: string };

function readOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(items: OfflineQueueItem[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items.slice(0, 50)));
}

function AdminCheckInInner() {
  const { user, userRole } = useAuth();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [history, setHistory] = useState<CheckInHistoryRow[]>([]);
  const [queueLen, setQueueLen] = useState(0);
  const processingRef = useRef(false);

  const refreshStats = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        fetchCheckInStats(supabase),
        fetchRecentCheckIns(supabase, 30),
      ]);
      setStats(s);
      setHistory(h);
    } catch {
      setStats(null);
    }
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) {
      void refreshStats();
      setQueueLen(readOfflineQueue().length);
    }
  }, [userRole, refreshStats]);

  useEffect(() => {
    const fromUrl = searchParams.get('code');
    if (fromUrl) setCode(normalizeBadgeScanInput(fromUrl));
  }, [searchParams]);

  const runCheckIn = useCallback(
    async (raw: string, opts?: { fromQueue?: boolean }) => {
      if (!user || processingRef.current) return;
      const cleaned = normalizeBadgeScanInput(raw);
      if (!cleaned) return;

      processingRef.current = true;
      setBusy(true);
      setResult(null);

      try {
        const res = await checkInByBadgeToken(supabase, cleaned, user.id);
        setResult(res);
        if (res.ok) {
          setCode('');
          void refreshStats();
          if (opts?.fromQueue) {
            const next = readOfflineQueue().filter((q) => normalizeBadgeScanInput(q.code) !== cleaned);
            writeOfflineQueue(next);
            setQueueLen(next.length);
          }
        }
      } catch {
        if (!opts?.fromQueue) {
          const queue = readOfflineQueue();
          queue.unshift({ code: cleaned, queuedAt: new Date().toISOString() });
          writeOfflineQueue(queue);
          setQueueLen(queue.length);
          setResult({
            ok: false,
            message:
              'Réseau indisponible — code mis en file locale. Il sera retenté automatiquement.',
          });
        } else {
          setResult({ ok: false, message: 'Échec réseau — la file locale est conservée.' });
        }
      }

      setBusy(false);
      processingRef.current = false;
    },
    [user, supabase, refreshStats]
  );

  // Retente la file hors-ligne
  useEffect(() => {
    if (!user || !isEventStaff(userRole)) return;
    const tick = async () => {
      const queue = readOfflineQueue();
      setQueueLen(queue.length);
      if (queue.length === 0 || processingRef.current || !navigator.onLine) return;
      const next = queue[0];
      await runCheckIn(next.code, { fromQueue: true });
    };
    const id = window.setInterval(() => void tick(), 8000);
    window.addEventListener('online', () => void tick());
    return () => {
      window.clearInterval(id);
    };
  }, [user, userRole, runCheckIn]);

  const downloadCsv = () => {
    const csv = exportCheckInHistoryCsv(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jsan-checkin-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès interdit</h2>
        <p style={{ color: '#64748b' }}>Réservé aux organisateurs.</p>
      </div>
    );
  }

  const pct = stats && stats.paid > 0 ? Math.round((stats.checkedIn / stats.paid) * 100) : 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 4px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>Check-in jour J</h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
        Scannez le QR avec la caméra, collez le contenu, ou saisissez le code court (8 caractères).
        Deep-link : <code style={{ fontSize: 12 }}>/dashboard/admin/check-in?code=JSAN:…</code>
      </p>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          <StatCard label="Billets payés" value={stats.paid} />
          <StatCard label="Entrées validées" value={stats.checkedIn} accent />
          <StatCard label="Restants" value={stats.remaining} />
          <StatCard label="Dernière heure" value={stats.lastHour} />
        </div>
      )}

      {stats && stats.paid > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            <span>Progression</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#1B6B2E', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {queueLen > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          File hors-ligne : {queueLen} code(s) en attente de synchronisation.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BadgeQrScanner disabled={busy} onScan={(raw) => void runCheckIn(raw)} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runCheckIn(code);
          }}
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}
        >
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
            Saisie manuelle
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
      </div>

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            border: `1px solid ${result.ok ? (result.ticket?.alreadyCheckedIn ? '#fde68a' : '#B7DFC0') : '#fecaca'}`,
            background: result.ok
              ? result.ticket?.alreadyCheckedIn
                ? '#fffbeb'
                : '#f0fdf4'
              : '#fef2f2',
            color: result.ok
              ? result.ticket?.alreadyCheckedIn
                ? '#92400e'
                : '#145224'
              : '#b91c1c',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{result.message}</div>
          {result.ticket && (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>
                <strong>{result.ticket.holderName}</strong>
              </div>
              <div>{result.ticket.type_billet}</div>
              {result.ticket.checked_in_at && (
                <div>Horodatage : {formatCheckInAt(result.ticket.checked_in_at)}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Dernières entrées</h2>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={history.length === 0}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#475569',
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              opacity: history.length === 0 ? 0.5 : 1,
            }}
          >
            Exporter CSV
          </button>
        </div>

        {history.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Aucune entrée validée pour le moment.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {history.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderBottom: '1px solid #f1f5f9',
                  flexWrap: 'wrap',
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.holderName}</div>
                  <div style={{ color: '#64748b' }}>
                    {row.type_billet} · <code>{row.shortCode}</code>
                  </div>
                </div>
                <div style={{ color: '#475569', whiteSpace: 'nowrap' }}>{formatCheckInAt(row.checked_in_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? '#E8F5EC' : '#fff',
        border: `1px solid ${accent ? '#B7DFC0' : '#e2e8f0'}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, color: accent ? '#145224' : '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? '#145224' : '#0f172a' }}>{value}</div>
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
