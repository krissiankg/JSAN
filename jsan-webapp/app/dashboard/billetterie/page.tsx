"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { useAuth } from '../../AuthContext';
import { isEventStaff } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import { getKkiapayPublicKey, isKkiapaySandbox } from '@/lib/kkiapay';
import {
  TICKET_CATALOG,
  type TicketCatalogItem,
  type TicketPaymentLinks,
  type TicketRegistration,
  formatFcfa,
  parseTicketPaymentLinks,
  paymentStatusLabel,
  paymentStatusColor,
  formatEventDates,
  type EventConfig,
} from '@/lib/tickets';

type BilletterieTab = 'boutique' | 'mes-billets' | 'comptabilite';

export default function BilletteriePage() {
  const { userRole, user, isStudentVerified, isMemberVerified } = useAuth();
  const isOrganisateur = isEventStaff(userRole);
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<BilletterieTab>('boutique');
  const [myTickets, setMyTickets] = useState<TicketRegistration[]>([]);
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<TicketPaymentLinks>({});
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [allTickets, setAllTickets] = useState<TicketRegistration[]>([]);
  const [customAlert, setCustomAlert] = useState<{ show: boolean; message: string; action?: () => void }>({ show: false, message: '' });

  const kkiapayPublicKey = getKkiapayPublicKey();
  const widgetReady = useRef(false);
  // Billet en attente pendant l'ouverture du widget (les listeners Kkiapay sont globaux).
  const pendingTicketRef = useRef<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    const ticketsQuery = isOrganisateur
      ? supabase.from('tickets_registrations').select('*').order('created_at', { ascending: false })
      : supabase.from('tickets_registrations').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

    const [ticketsRes, eventRes] = await Promise.all([
      ticketsQuery,
      supabase.from('events_config').select('id, nom_evenement, date_debut, date_fin, ticket_payment_links').limit(1).maybeSingle(),
    ]);

    const rows = (ticketsRes.data ?? []) as TicketRegistration[];
    if (isOrganisateur) setAllTickets(rows);
    setMyTickets(rows.filter((t) => t.user_id === user.id));
    if (eventRes.data) {
      setEventConfig(eventRes.data as EventConfig);
      setPaymentLinks(parseTicketPaymentLinks((eventRes.data as { ticket_payment_links?: unknown }).ticket_payment_links));
    }
    setLoadingTickets(false);
  }, [user, supabase, isOrganisateur]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Enregistre une seule fois les listeners globaux du widget Kkiapay.
  const registerKkiapayListeners = useCallback(() => {
    if (widgetReady.current || typeof window === 'undefined') return;
    if (!window.addSuccessListener || !window.addFailedListener) return;
    widgetReady.current = true;

    window.addSuccessListener(async (response) => {
      const ticketId = pendingTicketRef.current;
      pendingTicketRef.current = null;
      if (!ticketId || !response?.transactionId) return;
      try {
        const res = await fetch('/api/kkiapay/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, transactionId: response.transactionId }),
        });
        const json = (await res.json()) as { ok: boolean; message?: string };
        await loadTickets();
        setCustomAlert({
          show: true,
          message: json.ok
            ? 'Paiement confirmé ! Votre billet est désormais marqué « Payé ».'
            : `Paiement reçu, confirmation en cours de validation. ${json.message ?? ''}`.trim(),
          action: () => setActiveTab('mes-billets'),
        });
      } catch {
        await loadTickets();
        setCustomAlert({
          show: true,
          message: 'Paiement reçu. La confirmation sera finalisée sous peu (webhook).',
          action: () => setActiveTab('mes-billets'),
        });
      }
    });

    window.addFailedListener(async () => {
      pendingTicketRef.current = null;
      await loadTickets();
      setCustomAlert({ show: true, message: 'Le paiement a été annulé ou a échoué. Vous pouvez réessayer.' });
    });
  }, [loadTickets]);

  const handleBuy = async (ticket: TicketCatalogItem) => {
    if (ticket.requiresStudent && !isStudentVerified) {
      setCustomAlert({
        show: true,
        message: "Ce billet est réservé aux étudiants. Uploadez votre carte d'étudiant dans Mon Profil avant d'acheter.",
        action: () => { window.location.href = '/dashboard/profil'; },
      });
      return;
    }

    if (ticket.requiresMember && !isMemberVerified) {
      setCustomAlert({
        show: true,
        message: "Ce billet est réservé aux membres SNB. Uploadez votre attestation dans Mon Profil avant d'acheter.",
        action: () => { window.location.href = '/dashboard/profil'; },
      });
      return;
    }

    if (!user) return;

    // Voie 1 (préférée) : widget Kkiapay + confirmation automatique côté serveur.
    if (kkiapayPublicKey && typeof window !== 'undefined' && window.openKkiapayWidget) {
      const { data: created, error } = await supabase
        .from('tickets_registrations')
        .insert({
          user_id: user.id,
          type_billet: ticket.title,
          montant: ticket.amount,
          statut_paiement: 'En_Attente',
        })
        .select('id')
        .single();

      if (error || !created) {
        setCustomAlert({ show: true, message: "Impossible d'initier l'achat. Réessayez." });
        return;
      }

      await loadTickets();
      pendingTicketRef.current = created.id;
      registerKkiapayListeners();
      window.openKkiapayWidget({
        amount: ticket.amount,
        key: kkiapayPublicKey,
        sandbox: isKkiapaySandbox(),
        data: JSON.stringify({ ticketId: created.id }),
      });
      return;
    }

    // Voie 2 (repli) : lien de paiement statique + confirmation manuelle par l'organisateur.
    const link = paymentLinks[ticket.id];
    if (!link) {
      setCustomAlert({ show: true, message: "Le paiement en ligne n'est pas encore configuré. Contactez l'organisateur des JSAN." });
      return;
    }

    await supabase.from('tickets_registrations').insert({
      user_id: user.id,
      type_billet: ticket.title,
      montant: ticket.amount,
      statut_paiement: 'En_Attente',
    });
    await loadTickets();

    window.open(link, '_blank', 'noopener,noreferrer');
    setCustomAlert({
      show: true,
      message: "Vous allez être redirigé vers le paiement sécurisé Kkiapay. Une fois réglé, votre billet passera de « En attente » à « Payé » après validation par l'organisateur.",
      action: () => setActiveTab('mes-billets'),
    });
  };

  const tabStyle = (tab: BilletterieTab) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: activeTab === tab ? '#ffffff' : 'transparent',
    color: activeTab === tab ? '#2563eb' : '#64748b',
    fontWeight: activeTab === tab ? 600 : 500,
    boxShadow: activeTab === tab ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
    cursor: 'pointer' as const,
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '50px' }}>
      {kkiapayPublicKey && (
        <Script src="https://cdn.kkiapay.me/k.js" strategy="afterInteractive" onLoad={registerKkiapayListeners} />
      )}
      {/* Onglets */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#f8fafc', padding: '8px', borderRadius: '12px', width: 'fit-content', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('boutique')} style={tabStyle('boutique')}>🛒 Boutique</button>
        <button onClick={() => setActiveTab('mes-billets')} style={tabStyle('mes-billets')}>
          🎟️ Mes billets {myTickets.length > 0 && `(${myTickets.length})`}
        </button>
        {isOrganisateur && (
          <button onClick={() => setActiveTab('comptabilite')} style={tabStyle('comptabilite')}>📊 Comptabilité</button>
        )}
      </div>

      {activeTab === 'mes-billets' ? (
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#0f172a' }}>Mes billets</h2>
          <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>Historique de vos achats et inscriptions.</p>

          {loadingTickets ? (
            <p style={{ color: '#94a3b8' }}>Chargement…</p>
          ) : myTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
              <p style={{ color: '#64748b', marginBottom: '16px' }}>Aucun billet pour le moment.</p>
              <button onClick={() => setActiveTab('boutique')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Voir les billets disponibles
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Billet</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Montant</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {myTickets.map((t) => {
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'boutique' ? (
        <>
          <div style={{ position: 'relative', height: '280px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
            <img src="/media/media_library/jsan_event_banner.jpg" alt="JSAN" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2))' }} />
            <div style={{ position: 'absolute', bottom: '32px', left: '32px', color: 'white' }}>
              <h1 style={{ fontSize: '28px', margin: '0 0 8px', fontWeight: 700 }}>{eventConfig?.nom_evenement ?? 'JSAN 2025'}</h1>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                📅 {formatEventDates(eventConfig?.date_debut ?? '2025-06-10', eventConfig?.date_fin ?? '2025-06-14')}
                {' · '}📍 Palais des Congrès, Cotonou
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '20px' }}>Sélectionnez vos billets</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
            {TICKET_CATALOG.map((ticket) => (
              <div key={ticket.id} style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '160px', position: 'relative' }}>
                  <img src={ticket.img} alt={ticket.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.9)', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{ticket.category}</span>
                </div>
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: '17px', margin: '0 0 6px', color: '#0f172a' }}>{ticket.title}</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', flex: 1, lineHeight: 1.5 }}>{ticket.desc}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700 }}>{ticket.price}</span>
                    <button
                      onClick={() => handleBuy(ticket)}
                      style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Acheter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>Comptabilité &amp; Ventes</h2>
          <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>Toutes les transactions enregistrées sur la plateforme.</p>

          {loadingTickets ? (
            <p style={{ color: '#94a3b8' }}>Chargement…</p>
          ) : allTickets.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucune transaction pour le moment.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Billet</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Montant</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Transaction</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allTickets.map((t) => {
                    const c = paymentStatusColor(t.statut_paiement);
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 12px', fontWeight: 500 }}>{t.type_billet}</td>
                        <td style={{ padding: '14px 12px' }}>{formatFcfa(t.montant)}</td>
                        <td style={{ padding: '14px 12px', fontSize: '12px', color: '#64748b' }}>{t.transaction_id_kkiapay ?? '—'}</td>
                        <td style={{ padding: '14px 12px', fontSize: '13px', color: '#64748b' }}>{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '14px 12px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: c.bg, color: c.color }}>
                            {paymentStatusLabel(t.statut_paiement)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {customAlert.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '420px', width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>{customAlert.message}</p>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => { setCustomAlert({ show: false, message: '' }); customAlert.action?.(); }}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
