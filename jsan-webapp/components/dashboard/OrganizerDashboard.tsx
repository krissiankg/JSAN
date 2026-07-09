"use client";

import React from 'react';
import { useAuth } from '@/app/AuthContext';
import { isEventStaff } from '@/lib/roles';
import DashboardEventHero from '@/components/dashboard/DashboardEventHero';
import { getDashboardWelcomeConfig, getDisplayName } from '@/lib/dashboard-welcome';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const themeData = [
  { name: 'Nutrition Clinique', value: 45 },
  { name: 'Sécurité Sanitaire', value: 30 },
  { name: 'Nutrition Infantile', value: 15 },
  { name: 'Santé Publique', value: 10 },
];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

const countryData = [
  { name: 'Sénégal', auteurs: 120 },
  { name: "Côte d'Ivoire", auteurs: 85 },
  { name: 'Mali', auteurs: 45 },
  { name: 'France', auteurs: 30 },
  { name: 'Cameroun', auteurs: 25 },
];

const institutionData = [
  { name: 'UCAD', chercheurs: 65 },
  { name: 'Institut Pasteur', chercheurs: 40 },
  { name: 'IRD', chercheurs: 35 },
  { name: 'UFHB', chercheurs: 28 },
  { name: 'CNRS', chercheurs: 15 },
];

export default function OrganizerDashboard({ userRole }: { userRole: import('@/lib/roles').AppUserRole | null }) {
  const { profile, dbRole } = useAuth();
  const isOrganisateur = isEventStaff(userRole);
  const welcome = getDashboardWelcomeConfig(userRole, dbRole);
  const displayName = getDisplayName(profile?.prenom, profile?.nom, 'Administrateur');

  return (
    <div className="dashboard-page">
      <DashboardEventHero
        spaceLabel={welcome.spaceLabel}
        displayName={displayName}
        welcomeSubtitle={welcome.welcomeSubtitle}
        accentColor={welcome.accentColor}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Nombre d&apos;auteurs</div>
          <div className="dashboard-stat-card__number">305</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Soumissions</div>
          <div className="dashboard-stat-card__number">142</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card__label">Articles acceptés</div>
          <div className="dashboard-stat-card__number" style={{ color: '#10b981' }}>89</div>
        </div>
        {isOrganisateur && (
          <div className="dashboard-stat-card" style={{ background: '#111827', borderColor: '#111827' }}>
            <div className="dashboard-stat-card__label" style={{ color: '#94a3b8' }}>Montant collecté (CFA)</div>
            <div className="dashboard-stat-card__number" style={{ color: '#fff' }}>4.5M</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="dashboard-panel">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Auteurs par Pays</h2>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                <Bar dataKey="auteurs" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-panel">
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Soumissions par Thématique (%)</h2>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={themeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {themeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-panel" style={{ gridColumn: '1 / -1' }}>
          <h2 className="dashboard-panel__title" style={{ fontSize: '14px', marginBottom: '15px' }}>Chercheurs par Institution</h2>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={institutionData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#111827' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                <Bar dataKey="chercheurs" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
