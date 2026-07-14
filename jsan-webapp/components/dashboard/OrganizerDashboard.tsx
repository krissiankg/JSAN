"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import DashboardEventHero from '@/components/dashboard/DashboardEventHero';
import ProfileCompletenessBanner from '@/components/dashboard/ProfileCompletenessBanner';
import { getDashboardWelcomeConfig, getDisplayName } from '@/lib/dashboard-welcome';
import { formatFcfa } from '@/lib/tickets';
import {
  fetchReportsData,
  computeKpis,
  abstractsByTheme,
  usersByRole,
  usersByInstitution,
  usersByCountry,
  type ReportsData,
} from '@/lib/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#1B6B2E', '#f59e0b', '#3D8A4F', '#06b6d4', '#ef4444'];

export default function OrganizerDashboard({ userRole }: { userRole: import('@/lib/roles').AppUserRole | null }) {
  const { profile, dbRole } = useAuth();
  const supabase = createClient();
  const isOrganisateur = isEventStaff(userRole);
  const welcome = getDashboardWelcomeConfig(userRole, dbRole);
  const displayName = getDisplayName(profile?.prenom, profile?.nom, 'Administrateur');

  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchReportsData(supabase);
    setData(result);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data ? computeKpis(data) : null;
  const themeData = data ? abstractsByTheme(data) : [];
  const roleData = data ? usersByRole(data) : [];
  const institutionData = data ? usersByInstitution(data) : [];
  const countryData = data ? usersByCountry(data) : [];

  return (
    <div className="dashboard-page">
      <DashboardEventHero
        spaceLabel={welcome.spaceLabel}
        displayName={displayName}
        welcomeSubtitle={welcome.welcomeSubtitle}
        accentColor={welcome.accentColor}
      />

      <ProfileCompletenessBanner />

      <div className={`dashboard-stats-row${isOrganisateur ? '' : ' dashboard-stats-row--3'}`}>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Nombre d&apos;auteurs</div>
          <div className="dashboard-stat-card__number">{loading || !kpis ? '…' : kpis.auteurs}</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Soumissions</div>
          <div className="dashboard-stat-card__number">{loading || !kpis ? '…' : kpis.soumissions}</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Articles acceptés</div>
          <div className="dashboard-stat-card__number" style={{ color: '#10b981' }}>
            {loading || !kpis ? '…' : kpis.acceptes}
          </div>
        </div>
        {isOrganisateur && (
          <div className="dashboard-stat-card" style={{ background: '#111827', borderColor: '#111827' }}>
            <div className="dashboard-stat-card__label" style={{ color: '#94a3b8' }}>Montant collecté (CFA)</div>
            <div className="dashboard-stat-card__number" style={{ color: '#fff', fontSize: '22px' }}>
              {loading || !kpis ? '…' : formatFcfa(kpis.revenus).replace(' FCFA', '')}
            </div>
          </div>
        )}
      </div>

      {!loading && kpis && kpis.soumissions === 0 && kpis.utilisateurs === 0 && kpis.billetsPayes === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px' }}>
          Aucune donnée d&apos;activité pour l&apos;instant. Les indicateurs se rempliront avec les inscriptions et soumissions réelles.{' '}
          <Link href="/dashboard/admin/rapports" style={{ color: '#92400e', fontWeight: 600 }}>Voir les rapports →</Link>
        </div>
      )}

      <div className="dashboard-charts-grid">
        <div className="dashboard-panel">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Utilisateurs par pays</h2>
          <div className="dashboard-chart-box">
            {loading ? (
              <p className="dashboard-empty-text">Chargement…</p>
            ) : countryData.length === 0 ? (
              <p className="dashboard-empty-text">Aucun pays renseigné sur les profils.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                  <Bar dataKey="value" name="Utilisateurs" fill="#1B6B2E" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="dashboard-panel">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Utilisateurs par rôle</h2>
          <div className="dashboard-chart-box">
            {loading ? (
              <p className="dashboard-empty-text">Chargement…</p>
            ) : roleData.length === 0 ? (
              <p className="dashboard-empty-text">Pas encore de profils enregistrés.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                  <Bar dataKey="value" name="Utilisateurs" fill="#3D8A4F" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="dashboard-panel">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Soumissions par thématique</h2>
          <div className="dashboard-chart-box">
            {loading ? (
              <p className="dashboard-empty-text">Chargement…</p>
            ) : themeData.length === 0 ? (
              <p className="dashboard-empty-text">Aucune soumission avec thématique pour l&apos;instant.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={themeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name" stroke="none">
                    {themeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="dashboard-panel dashboard-charts-grid__full">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Profils par institution</h2>
          <div className="dashboard-chart-box">
            {loading ? (
              <p className="dashboard-empty-text">Chargement…</p>
            ) : institutionData.length === 0 ? (
              <p className="dashboard-empty-text">Aucune institution renseignée sur les profils.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={institutionData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#111827' }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Bar dataKey="value" name="Profils" fill="#10b981" radius={[0, 4, 4, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
