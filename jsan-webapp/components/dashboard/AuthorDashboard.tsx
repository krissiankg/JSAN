"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import ParticipantDashboard from '@/components/dashboard/ParticipantDashboard';
import {
  type Abstract,
  type AbstractStatus,
  ABSTRACT_SELECT,
  abstractStatusLabel,
  abstractStatusStyle,
} from '@/lib/abstracts';

export default function AuthorDashboard() {
  const { user } = useAuth();
  const supabase = createClient();

  const [abstracts, setAbstracts] = useState<Abstract[]>([]);
  const [loadingAbstracts, setLoadingAbstracts] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('abstracts')
        .select(ABSTRACT_SELECT)
        .eq('author_id', user.id)
        .order('updated_at', { ascending: false });
      if (data) setAbstracts(data as Abstract[]);
      setLoadingAbstracts(false);
    }
    load();
  }, [user, supabase]);

  const countByStatus = (status: AbstractStatus | AbstractStatus[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return abstracts.filter((a) => statuses.includes(a.statut)).length;
  };

  const drafts = countByStatus('Brouillon');
  const submitted = countByStatus(['Soumis', 'En_Evaluation']);
  const decided = countByStatus(['Accepte', 'Rejete', 'A_Reviser']);

  return (
    <ParticipantDashboard showBilletterieBlocks={false}>
      <div className="dashboard-role-section">
        <h2 className="dashboard-panel__title dashboard-panel__title--section">📄 Mes soumissions scientifiques</h2>

        <div className="dashboard-stat-grid">
          {[
            { label: 'Brouillons', value: drafts, icon: '📝', href: '/dashboard/brouillons-resumes' },
            { label: 'En évaluation', value: submitted, icon: '⏳', href: '/dashboard/mes-resumes' },
            { label: 'Décisions reçues', value: decided, icon: '✅', href: '/dashboard/statut-evaluations' },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="dashboard-stat-link">
              <div className="dashboard-stat-card__label">{stat.icon} {stat.label.toUpperCase()}</div>
              <div className="dashboard-stat-card__number">{loadingAbstracts ? '…' : stat.value}</div>
            </Link>
          ))}
        </div>

        <div className="dashboard-quick-actions" style={{ marginBottom: '20px' }}>
          <Link href="/dashboard/nouvelle-soumission" className="dashboard-btn dashboard-btn--dark">
            ➕ Nouvelle soumission
          </Link>
          <Link href="/dashboard/mes-resumes" className="dashboard-btn dashboard-btn--secondary">
            Voir mes résumés soumis
          </Link>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h3 className="dashboard-panel__title" style={{ fontSize: '16px' }}>Activité récente</h3>
            <Link href="/dashboard/brouillons-resumes" className="dashboard-link-inline">Tous les brouillons →</Link>
          </div>

          {loadingAbstracts ? (
            <p className="dashboard-empty-text">Chargement de vos soumissions…</p>
          ) : abstracts.length === 0 ? (
            <div className="dashboard-empty-state">
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
              <p>Vous n&apos;avez pas encore soumis de résumé.</p>
              <Link href="/dashboard/nouvelle-soumission" className="dashboard-btn dashboard-btn--dark">
                Commencer une soumission
              </Link>
            </div>
          ) : (
            <div className="dashboard-list">
              {abstracts.slice(0, 5).map((a) => {
                const style = abstractStatusStyle(a.statut);
                const editHref = a.statut === 'Brouillon'
                  ? `/dashboard/nouvelle-soumission?id=${a.id}`
                  : '/dashboard/mes-resumes';
                return (
                  <Link key={a.id} href={editHref} className="dashboard-list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="dashboard-list-item__title" style={{ flex: 1 }}>
                      {a.titre || 'Sans titre'}
                    </div>
                    <span className="dashboard-status-pill" style={{ background: style.background, color: style.color }}>
                      {abstractStatusLabel(a.statut)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ParticipantDashboard>
  );
}
