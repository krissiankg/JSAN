"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import type { KkiapayAdminView } from '@/lib/kkiapay-settings';
import {
  TICKET_CATALOG,
  type TicketCatalogItem,
  type TicketPaymentLinks,
  type TicketRegistration,
  type PaymentStatus,
  fetchTicketCatalog,
  formatFcfa,
  isValidPaymentUrl,
  parseTicketPaymentLinks,
  pruneTicketPaymentLinks,
  paymentStatusColor,
  paymentStatusLabel,
} from '@/lib/tickets';
import { notifyPaymentConfirmed, notifyPaymentFailed } from '@/lib/notifications';

export default function AdminPaiements() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [eventConfigId, setEventConfigId] = useState<string | null>(null);
  const [links, setLinks] = useState<TicketPaymentLinks>({});
  const [transactions, setTransactions] = useState<TicketRegistration[]>([]);
  const [catalog, setCatalog] = useState<TicketCatalogItem[]>(TICKET_CATALOG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [kkiapayView, setKkiapayView] = useState<KkiapayAdminView | null>(null);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [sandbox, setSandbox] = useState(true);

  const loadKkiapayConfig = useCallback(async () => {
    const res = await fetch('/api/admin/kkiapay-config');
    const data = (await res.json().catch(() => null)) as { ok?: boolean; config?: KkiapayAdminView; error?: string } | null;
    if (res.ok && data?.ok && data.config) {
      setKkiapayView(data.config);
      setPublicKey(data.config.publicKey);
      setSandbox(data.config.sandbox);
      setPrivateKey('');
      setSecretKey('');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [configRes, txRes, catalogRows] = await Promise.all([
      supabase.from('events_config').select('id, ticket_payment_links').limit(1).maybeSingle(),
      supabase.from('tickets_registrations').select('*').order('created_at', { ascending: false }),
      fetchTicketCatalog(supabase, { activeOnly: false }),
      loadKkiapayConfig(),
    ]);

    if (configRes.data) {
      setEventConfigId(configRes.data.id);
      setLinks(parseTicketPaymentLinks(configRes.data.ticket_payment_links));
    }
    setCatalog(catalogRows);
    setTransactions((txRes.data ?? []) as TicketRegistration[]);
    setLoading(false);
  }, [supabase, loadKkiapayConfig]);

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

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    setMessage(null);
    const res = await fetch('/api/admin/kkiapay-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey,
        privateKey: privateKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
        sandbox,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; config?: KkiapayAdminView; error?: string } | null;
    setSavingKeys(false);
    if (!res.ok || !data?.ok || !data.config) {
      setMessage({
        type: 'error',
        text: data?.error || 'Impossible d’enregistrer les clés. Exécutez la migration 033 dans Supabase si besoin.',
      });
      return;
    }
    setKkiapayView(data.config);
    setPublicKey(data.config.publicKey);
    setSandbox(data.config.sandbox);
    setPrivateKey('');
    setSecretKey('');
    setMessage({ type: 'success', text: 'Clés Kkiapay enregistrées. Le paiement automatique est prêt si les 3 clés sont renseignées.' });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleClearSecrets = async () => {
    if (!confirm('Effacer la clé privée et le secret stockés en base ? (Les variables d’environnement Netlify restent intactes.)')) return;
    setSavingKeys(true);
    const res = await fetch('/api/admin/kkiapay-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey,
        sandbox,
        clearPrivateKey: true,
        clearSecretKey: true,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; config?: KkiapayAdminView; error?: string } | null;
    setSavingKeys(false);
    if (!res.ok || !data?.ok || !data.config) {
      setMessage({ type: 'error', text: data?.error || 'Impossible d’effacer les secrets.' });
      return;
    }
    setKkiapayView(data.config);
    setMessage({ type: 'success', text: 'Secrets effacés de la base.' });
  };

  const handleSaveLinks = async () => {
    if (!eventConfigId) {
      setMessage({ type: 'error', text: 'Configuration événement introuvable.' });
      return;
    }

    const invalid = Object.entries(links).find(([, url]) => url.trim() && !isValidPaymentUrl(url));
    if (invalid) {
      setMessage({ type: 'error', text: `Lien invalide pour « ${catalog.find((t) => t.id === invalid[0])?.title ?? invalid[0]} ». Utilisez une URL https.` });
      return;
    }

    setSaving(true);
    setMessage(null);

    const cleaned: TicketPaymentLinks = {};
    const validIds = new Set(catalog.map((t) => t.id));
    for (const [id, url] of Object.entries(links)) {
      if (url.trim() && validIds.has(id)) cleaned[id] = url.trim();
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
    await pruneTicketPaymentLinks(supabase, catalog.map((t) => t.id));
    setMessage({ type: 'success', text: 'Liens de paiement enregistrés (orphelins retirés).' });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateTransactionStatus = async (id: string, statut: PaymentStatus) => {
    const ticket = transactions.find((t) => t.id === id);
    const payload: Record<string, unknown> = { statut_paiement: statut };
    if (statut === 'Paye') {
      payload.badge_token = crypto.randomUUID();
    }
    const { error } = await supabase
      .from('tickets_registrations')
      .update(payload)
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, statut_paiement: statut } : t)));

    if (ticket) {
      if (statut === 'Paye') {
        void notifyPaymentConfirmed(supabase, ticket.user_id, {
          typeBillet: ticket.type_billet,
          montant: ticket.montant,
          reference: ticket.transaction_id_kkiapay ?? ticket.id,
        });
      } else if (statut === 'Echoue') {
        void notifyPaymentFailed(supabase, ticket.user_id, {
          typeBillet: ticket.type_billet,
          montant: ticket.montant,
        });
      }
    }
  };

  const configuredCount = Object.values(links).filter((u) => u.trim()).length;
  const autoMode = Boolean(kkiapayView?.autoMode);
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/kkiapay/webhook` : '/api/kkiapay/webhook';

  return (
    <div className="page-shell page-shell--narrow" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Paiements &amp; Billetterie</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            Configurez le paiement automatique Kkiapay (clés API) et/ou les liens de paiement manuels par billet.
          </p>
        </div>
        <a
          href="/dashboard/admin/billets"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '13px',
            whiteSpace: 'nowrap',
          }}
        >
          Catalogue billets →
        </a>
      </div>

      <div style={{
        background: autoMode ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${autoMode ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: '12px', padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px' }}>{autoMode ? '✅' : '⚙️'}</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: autoMode ? '#166534' : '#b45309' }}>
            {autoMode ? 'Confirmation automatique active' : 'Mode manuel — clés Kkiapay incomplètes'}
          </h2>
          {autoMode && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: '10px' }}>
              {sandbox ? 'SANDBOX (test)' : 'PRODUCTION'}
            </span>
          )}
        </div>
        {autoMode ? (
          <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 8px' }}>
              Les billets passent automatiquement à « Payé » après paiement. Collez cette URL de <strong>webhook</strong> dans Kkiapay :
            </p>
            <code style={{ display: 'block', background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#14532d', wordBreak: 'break-all' }}>
              {webhookUrl}
            </code>
            {kkiapayView?.source && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', opacity: 0.85 }}>
                Source des clés : {kkiapayView.source === 'database' ? 'base de données (cette page)' : kkiapayView.source === 'env' ? 'variables d’environnement' : 'mixte (DB + env)'}
              </p>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#b45309', lineHeight: 1.7 }}>
            Renseignez les 3 clés ci-dessous pour activer le widget et la confirmation automatique.
            En attendant, utilisez les <strong>liens de paiement</strong> et confirmez les transactions à la main.
          </p>
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

      {/* Clés API Kkiapay */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
          Clés API Kkiapay (paiement automatique)
        </h2>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
          Récupérez ces clés dans votre tableau de bord Kkiapay. La clé publique ouvre le widget ;
          la clé privée et le secret restent côté serveur (jamais exposés aux participants).
          Laissez un champ secret vide pour conserver la valeur déjà enregistrée.
        </p>

        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Clé publique (Public key)</label>
            <input
              style={inputStyle}
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_…"
              autoComplete="off"
            />
          </div>
          <div>
            <label style={labelStyle}>
              Clé privée (Private key)
              {kkiapayView?.privateKeyConfigured && (
                <span style={{ fontWeight: 500, color: '#166534', marginLeft: '8px' }}>
                  · enregistrée {kkiapayView.privateKeyMasked ? `(${kkiapayView.privateKeyMasked})` : ''}
                </span>
              )}
            </label>
            <input
              style={inputStyle}
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder={kkiapayView?.privateKeyConfigured ? '•••• laisser vide pour ne pas changer' : 'sk_…'}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={labelStyle}>
              Secret
              {kkiapayView?.secretKeyConfigured && (
                <span style={{ fontWeight: 500, color: '#166534', marginLeft: '8px' }}>
                  · enregistré {kkiapayView.secretKeyMasked ? `(${kkiapayView.secretKeyMasked})` : ''}
                </span>
              )}
            </label>
            <input
              style={inputStyle}
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={kkiapayView?.secretKeyConfigured ? '•••• laisser vide pour ne pas changer' : 'secret…'}
              autoComplete="new-password"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', fontWeight: 600 }}>
            <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
            Mode sandbox (test) — décochez pour la production
          </label>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(kkiapayView?.privateKeyConfigured || kkiapayView?.secretKeyConfigured) && (
            <button
              type="button"
              onClick={handleClearSecrets}
              disabled={savingKeys}
              style={{
                background: '#fff', color: '#b91c1c', border: '1px solid #fecaca',
                padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Effacer secrets en base
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveKeys}
            disabled={savingKeys || loading}
            style={{
              backgroundColor: '#166534', color: '#fff', padding: '10px 24px', borderRadius: '8px',
              fontWeight: 600, border: 'none', cursor: savingKeys ? 'not-allowed' : 'pointer', opacity: savingKeys ? 0.7 : 1,
            }}
          >
            {savingKeys ? 'Enregistrement…' : 'Enregistrer les clés'}
          </button>
        </div>
      </div>

      {/* Liens de paiement par produit */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Liens de paiement par billet (mode manuel)
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
              Utilisés si le widget automatique n’est pas disponible, ou en secours.
            </p>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {configuredCount}/{catalog.length} configurés
          </span>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {catalog.map((ticket) => {
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
