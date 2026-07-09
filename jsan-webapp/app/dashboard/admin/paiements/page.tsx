"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { getKkiapayPublicKey, isKkiapaySandbox } from '@/lib/kkiapay';
import {
  TICKET_CATALOG,
  type TicketPaymentLinks,
  type TicketRegistration,
  type PaymentStatus,
  formatFcfa,
  isValidPaymentUrl,
  parseTicketPaymentLinks,
  paymentStatusColor,
  paymentStatusLabel,
} from '@/lib/tickets';

export default function AdminPaiements() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [eventConfigId, setEventConfigId] = useState<string | null>(null);
  const [links, setLinks] = useState<TicketPaymentLinks>({});
  const [transactions, setTransactions] = useState<TicketRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [configRes, txRes] = await Promise.all([
      supabase.from('events_config').select('id, ticket_payment_links').limit(1).maybeSingle(),
      supabase.from('tickets_registrations').select('*').order('created_at', { ascending: false }),
    ]);

    if (configRes.data) {
      setEventConfigId(configRes.data.id);
      setLinks(parseTicketPaymentLinks(configRes.data.ticket_payment_links));
    }
    setTransactions((txRes.data ?? []) as TicketRegistration[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) load();
  }, [userRole, load]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer les paiements.</p>
      </div>
    );
  }

  const setLink = (id: string, url: string) => {
    setLinks((prev) => ({ ...prev, [id]: url }));
  };

  const handleSaveLinks = async () => {
    if (!eventConfigId) {
      setMessage({ type: 'error', text: 'Configuration événement introuvable.' });
      return;
    }

    const invalid = Object.entries(links).find(([, url]) => url.trim() && !isValidPaymentUrl(url));
    if (invalid) {
      setMessage({ type: 'error', text: `Lien invalide pour « ${TICKET_CATALOG.find((t) => t.id === invalid[0])?.title ?? invalid[0]} ». Utilisez une URL https.` });
      return;
    }

    setSaving(true);
    setMessage(null);

    const cleaned: TicketPaymentLinks = {};
    for (const [id, url] of Object.entries(links)) {
      if (url.trim()) cleaned[id] = url.trim();
    }

    const { error } = await supabase
      .from('events_config')
      .update({ ticket_payment_links: cleaned })
      .eq('id', eventConfigId);

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setLinks(cleaned);
    setMessage({ type: 'success', text: 'Liens de paiement enregistrés.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateTransactionStatus = async (id: string, statut: PaymentStatus) => {
    const { error } = await supabase
      .from('tickets_registrations')
      .update({ statut_paiement: statut })
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, statut_paiement: statut } : t)));
  };

  const configuredCount = Object.values(links).filter((u) => u.trim()).length;
  const autoMode = getKkiapayPublicKey().length > 0;
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/kkiapay/webhook` : '/api/kkiapay/webhook';

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Paiements &amp; Billetterie</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
          Renseignez pour chaque billet le lien de paiement créé dans votre tableau de bord Kkiapay.
          Le bouton « Acheter » de la boutique redirigera le participant vers ce lien.
        </p>
      </div>

      {/* Statut du mode de paiement */}
      <div style={{
        background: autoMode ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${autoMode ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: '12px', padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px' }}>{autoMode ? '✅' : '⚙️'}</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: autoMode ? '#166534' : '#b45309' }}>
            {autoMode ? 'Confirmation automatique active' : 'Mode manuel (clés Kkiapay non configurées)'}
          </h2>
          {autoMode && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: '10px' }}>
              {isKkiapaySandbox() ? 'SANDBOX (test)' : 'PRODUCTION'}
            </span>
          )}
        </div>
        {autoMode ? (
          <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 8px' }}>
              Les billets passent automatiquement à « Payé » après paiement (vérifié auprès de Kkiapay).
              Collez cette URL de <strong>webhook</strong> dans votre tableau de bord Kkiapay pour fiabiliser la confirmation :
            </p>
            <code style={{ display: 'block', background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#14532d', wordBreak: 'break-all' }}>
              {webhookUrl}
            </code>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#b45309', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 4px' }}>
              Renseignez les clés Kkiapay dans les variables d&apos;environnement (<code>NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY</code>,
              <code> KKIAPAY_PRIVATE_KEY</code>, <code>KKIAPAY_SECRET</code>) pour activer la confirmation automatique.
            </p>
            <p style={{ margin: 0 }}>
              En attendant, utilisez les <strong>liens de paiement</strong> ci-dessous et confirmez chaque transaction à la main.
            </p>
          </div>
        )}
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
          background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Liens de paiement par produit */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Liens de paiement par billet
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {configuredCount}/{TICKET_CATALOG.length} configurés
          </span>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {TICKET_CATALOG.map((ticket) => {
              const url = links[ticket.id] ?? '';
              const ok = url.trim() && isValidPaymentUrl(url);
              return (
                <div key={ticket.id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '14px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{ticket.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{ticket.price}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setLink(ticket.id, e.target.value)}
                      placeholder="https://me.kkiapay.me/..."
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
                        border: `1px solid ${url.trim() && !ok ? '#fca5a5' : '#d1d5db'}`,
                      }}
                    />
                    <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>
                      {url.trim() ? (ok ? '✅' : '⚠️') : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '24px', borderTop: '1px solid #f3f4f6', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSaveLinks}
            disabled={saving || loading}
            style={{
              backgroundColor: '#111827', color: '#fff', padding: '10px 24px', borderRadius: '8px',
              fontWeight: 600, border: 'none', cursor: saving || loading ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les liens'}
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Transactions</h2>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>
          Après vérification d&apos;un paiement dans Kkiapay, confirmez ou rejetez la transaction correspondante.
        </p>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : transactions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Aucune transaction enregistrée.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Billet</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Montant</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Statut</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const c = paymentStatusColor(t.statut_paiement);
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 12px', fontWeight: 500, color: '#0f172a' }}>{t.type_billet}</td>
                      <td style={{ padding: '14px 12px', color: '#334155' }}>{formatFcfa(t.montant)}</td>
                      <td style={{ padding: '14px 12px', color: '#64748b', fontSize: '13px' }}>
                        {new Date(t.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: c.bg, color: c.color }}>
                          {paymentStatusLabel(t.statut_paiement)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {t.statut_paiement !== 'Paye' && (
                          <button
                            type="button"
                            onClick={() => updateTransactionStatus(t.id, 'Paye')}
                            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}
                          >
                            Confirmer
                          </button>
                        )}
                        {t.statut_paiement !== 'Echoue' && (
                          <button
                            type="button"
                            onClick={() => updateTransactionStatus(t.id, 'Echoue')}
                            style={{ background: 'transparent', color: '#b91c1c', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Rejeter
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
