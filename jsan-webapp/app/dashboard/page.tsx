"use client";

import React from 'react';
import { useAuth } from '../AuthContext';
import ParticipantDashboard from '@/components/dashboard/ParticipantDashboard';
import AuthorDashboard from '@/components/dashboard/AuthorDashboard';
import EvaluatorDashboard from '@/components/dashboard/EvaluatorDashboard';
import OrganizerDashboard from '@/components/dashboard/OrganizerDashboard';

export default function DashboardPage() {
  const { userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
        Chargement du tableau de bord…
      </div>
    );
  }

  if (userRole === 'participant') {
    return <ParticipantDashboard />;
  }

  if (userRole === 'auteur') {
    return <AuthorDashboard />;
  }

  if (userRole === 'pair') {
    return <EvaluatorDashboard />;
  }

  return <OrganizerDashboard userRole={userRole} />;
}
