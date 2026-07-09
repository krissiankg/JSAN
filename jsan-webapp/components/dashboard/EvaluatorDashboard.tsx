"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import ParticipantDashboard from '@/components/dashboard/ParticipantDashboard';

export default function EvaluatorDashboard() {
  const { isEvaluatorApproved } = useAuth();
  const approved = isEvaluatorApproved;

  return (
    <ParticipantDashboard>
      <div className="dashboard-role-section">
        <h2 className="dashboard-panel__title dashboard-panel__title--section">
          ⚖️ {approved ? 'Mes évaluations' : 'Candidature évaluateur'}
        </h2>

        {approved ? (
          <>
            <div className="dashboard-stat-grid">
              {[
                { label: 'Résumés à évaluer', icon: '📄', href: '/dashboard/resumes-a-evaluer' },
                { label: 'Articles à évaluer', icon: '📑', href: '/dashboard/articles-a-evaluer' },
                { label: 'Mes soumissions', icon: '📝', href: '/dashboard/mes-resumes' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="dashboard-stat-link">
                  <div className="dashboard-stat-card__label">{item.icon} {item.label.toUpperCase()}</div>
                  <div className="dashboard-stat-card__hint">Accéder →</div>
                </Link>
              ))}
            </div>

            <div className="dashboard-quick-actions">
              <Link href="/dashboard/resumes-a-evaluer" className="dashboard-btn dashboard-btn--primary">
                Commencer une évaluation
              </Link>
              <Link href="/dashboard/statut-evaluations" className="dashboard-btn dashboard-btn--secondary">
                Statut de mes soumissions
              </Link>
            </div>
          </>
        ) : (
          <div className="dashboard-panel">
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
              Votre profil évaluateur est en attente de validation par l&apos;organisateur des JSAN.
              Vous pouvez déjà gérer votre inscription, vos billets et votre profil.
            </p>
            <Link href="/dashboard/profil" className="dashboard-btn dashboard-btn--secondary">
              Compléter mon profil
            </Link>
          </div>
        )}
      </div>
    </ParticipantDashboard>
  );
}
