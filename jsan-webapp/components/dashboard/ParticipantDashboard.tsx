"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import DashboardEventHero from '@/components/dashboard/DashboardEventHero';
import { getDashboardWelcomeConfig, getDisplayName } from '@/lib/dashboard-welcome';
import {
  type TicketRegistration,
  type EventConfig,
  formatEventDates,
  formatFcfa,
  paymentStatusLabel,
  paymentStatusColor,
} from '@/lib/tickets';

interface ParticipantDashboardProps {
  spaceLabel?: string;
  welcomeSubtitle?: string;
  accentColor?: string;
  showBilletterieBlocks?: boolean;
  children?: React.ReactNode;
}

export default function ParticipantDashboard({
  spaceLabel,
  welcomeSubtitle,
  accentColor,
  showBilletterieBlocks = true,
  children,
}: ParticipantDashboardProps) {
  const { profile, user, userRole, dbRole, isStudentVerified, isMemberVerified } = useAuth();
  const supabase = createClient();
  const welcome = getDashboardWelcomeConfig(userRole, dbRole);

  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [myTickets, setMyTickets] = useState<TicketRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = getDisplayName(profile?.prenom, profile?.nom, 'Utilisateur');

  useEffect(() => {
    async function load() {
      if (!user) return;

      const eventRes = await supabase.from('events_config').select('id, nom_evenement, date_debut, date_fin').limit(1).maybeSingle();
      if (eventRes.data) setEventConfig(eventRes.data as EventConfig);

      if (showBilletterieBlocks) {
        const ticketsRes = await supabase
          .from('tickets_registrations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (ticketsRes.data) setMyTickets(ticketsRes.data as TicketRegistration[]);
      }

      setLoading(false);
    }
    load();
  }, [user, supabase, showBilletterieBlocks]);

  const paidCount = myTickets.filter((t) => t.statut_paiement === 'Paye').length;
  const pendingCount = myTickets.filter((t) => t.statut_paiement === 'En_Attente').length;

  return (
    <div className="dashboard-page">
      <DashboardEventHero
        spaceLabel={spaceLabel ?? welcome.spaceLabel}
        displayName={displayName}
        welcomeSubtitle={welcomeSubtitle ?? welcome.welcomeSubtitle}
        accentColor={accentColor ?? welcome.accentColor}
      />

      <div className="dashboard-stats-row dashboard-stats-row--3">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">📅 ÉVÉNEMENT</div>
          <div className="dashboard-stat-card__value">{eventConfig?.nom_evenement ?? 'JSAN 2025'}</div>
          <div className="dashboard-stat-card__hint">
            {formatEventDates(eventConfig?.date_debut ?? '2025-06-10', eventConfig?.date_fin ?? '2025-06-14')}
          </div>
          <div className="dashboard-stat-card__hint">📍 Palais des Congrès, Cotonou</div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">🎟️ MES BILLETS</div>
          {loading ? (
            <div className="dashboard-stat-card__hint">Chargement…</div>
          ) : (
            <>
              <div className="dashboard-stat-card__number">{paidCount}</div>
              <div className="dashboard-stat-card__hint">
                billet{paidCount !== 1 ? 's' : ''} payé{paidCount !== 1 ? 's' : ''}
                {pendingCount > 0 && ` · ${pendingCount} en attente`}
              </div>
            </>
          )}
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">📄 JUSTIFICATIFS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: isStudentVerified ? '#166534' : '#b45309' }}>
              {isStudentVerified ? '✓' : '○'} Statut étudiant {isStudentVerified ? 'validé' : 'non validé'}
            </span>
            <span style={{ color: isMemberVerified ? '#166534' : '#b45309' }}>
              {isMemberVerified ? '✓' : '○'} Membre SNB {isMemberVerified ? 'validé' : 'non validé'}
            </span>
          </div>
          {!isStudentVerified && !isMemberVerified && (
            <Link href="/dashboard/profil" className="dashboard-link-inline">
              Compléter mes justificatifs →
            </Link>
          )}
        </div>
      </div>

      {showBilletterieBlocks && (
        <>
          <div className="dashboard-quick-actions">
            <Link href="/dashboard/billetterie" className="dashboard-btn dashboard-btn--primary">
              🎟️ Acheter un billet
            </Link>
            <Link href="/dashboard/profil" className="dashboard-btn dashboard-btn--secondary">
              👤 Mon profil
            </Link>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2 className="dashboard-panel__title">Mes billets récents</h2>
              <Link href="/dashboard/billetterie" className="dashboard-link-inline">Voir tout →</Link>
            </div>

            {loading ? (
              <p className="dashboard-empty-text">Chargement de vos billets…</p>
            ) : myTickets.length === 0 ? (
              <div className="dashboard-empty-state">
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎟️</div>
                <p>Vous n&apos;avez pas encore de billet pour les JSAN.</p>
                <Link href="/dashboard/billetterie" className="dashboard-btn dashboard-btn--dark">
                  Parcourir les billets
                </Link>
              </div>
            ) : (
              <div className="dashboard-list">
                {myTickets.slice(0, 5).map((ticket) => {
                  const colors = paymentStatusColor(ticket.statut_paiement);
                  return (
                    <div key={ticket.id} className="dashboard-list-item">
                      <div>
                        <div className="dashboard-list-item__title">{ticket.type_billet}</div>
                        <div className="dashboard-list-item__meta">
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {ticket.transaction_id_kkiapay && ` · ${ticket.transaction_id_kkiapay}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatFcfa(ticket.montant)}</span>
                        <span className="dashboard-status-pill" style={{ background: colors.bg, color: colors.color }}>
                          {paymentStatusLabel(ticket.statut_paiement)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {children}
    </div>
  );
}
