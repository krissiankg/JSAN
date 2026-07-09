"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { isEventStaff } from '@/lib/roles';

export default function EventStaffGuard({ children }: { children: React.ReactNode }) {
  const { userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="dashboard-content" style={{ padding: '40px', color: '#64748b' }}>
        Chargement…
      </div>
    );
  }

  if (!isEventStaff(userRole)) {
    return (
      <div className="dashboard-content">
        <div
          className="alert-card"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          <h2>Accès refusé</h2>
          <p>Vous n&apos;avez pas les droits nécessaires pour accéder à cette section.</p>
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{ marginTop: '15px', display: 'inline-block' }}
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
