"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatFcfa } from '@/lib/tickets';
import {
  type BadgeTicket,
  fetchMyPaidBadges,
  formatCheckInAt,
  shortBadgeCode,
} from '@/lib/check-in';
import { getDisplayName } from '@/lib/dashboard-welcome';
import BadgeQrCode from '@/components/BadgeQrCode';

export default function BadgePage() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [tickets, setTickets] = useState<BadgeTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = getDisplayName(profile?.prenom, profile?.nom, 'Participant');

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMyPaidBadges(supabase, user.id);
        setTickets(rows);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur de chargement.';
        const hint = msg.includes('badge_token')
          ? ' Exécutez la migration 036 dans Supabase.'
          : '';
        setError(`${msg}${hint}`);
      }
      setLoading(false);
    }
    void load();
  }, [user, supabase]);

  return (
    <div className="badge-page" style={{ maxWidth: 720, margin: '0 auto', padding: '12px 4px 40px' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .badge-page, .badge-page * { visibility: visible !important; }
          .badge-page {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 0 !important;
            margin: 0 !important;
          }
          .badge-no-print { display: none !important; }
          .badge-card {
            break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            margin-bottom: 16px !important;
          }
        }
      `}</style>

      <div className="badge-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>Mon badge</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Présentez le QR code à l&apos;entrée. Un billet payé = un badge.
          </p>
        </div>
        {tickets.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Imprimer / PDF
          </button>
        )}
      </div>

      {error && (
        <div className="badge-no-print" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="badge-no-print" style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : tickets.length === 0 ? (
        <div className="badge-no-print" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎫</div>
          <p style={{ color: '#64748b', margin: '0 0 14px' }}>Aucun billet payé pour générer un badge.</p>
          <Link href="/dashboard/billetterie" style={{ color: '#1B6B2E', fontWeight: 600, textDecoration: 'none' }}>
            Aller à la billetterie →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tickets.map((ticket) => {
            const token = ticket.badge_token;
            const code = shortBadgeCode(token);
            const qrPayload = `JSAN:${token}`;
            return (
              <div
                key={ticket.id}
                className="badge-card"
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0F2E18 0%, #1B6B2E 100%)',
                    color: '#fff',
                    padding: '16px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>JSAN — Badge participant</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{displayName}</div>
                    <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{ticket.type_billet}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <div>{formatFcfa(ticket.montant)}</div>
                    {ticket.checked_in_at ? (
                      <div style={{ marginTop: 6, color: '#bbf7d0' }}>✓ Entrée {formatCheckInAt(ticket.checked_in_at)}</div>
                    ) : (
                      <div style={{ marginTop: 6, opacity: 0.8 }}>Non encore scanné</div>
                    )}
                  </div>
                </div>

                <div style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <BadgeQrCode payload={qrPayload} size={200} alt={`QR badge ${code}`} />
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Code manuel</div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: 2,
                        color: '#0f172a',
                      }}
                    >
                      {code}
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                      Si le scan échoue, l&apos;organisateur peut saisir ce code.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
