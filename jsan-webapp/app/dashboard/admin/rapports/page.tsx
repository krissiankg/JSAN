"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { formatFcfa } from '@/lib/tickets';
import {
  fetchReportsData,
  computeKpis,
  abstractsByStatus,
  abstractsByTheme,
  articlesByStatus,
  reviewsByStatus,
  usersByRole,
  paymentsByStatus,
  revenueByTicket,
  usersByCountry,
  type ReportsData,
  type ChartDatum,
} from '@/lib/reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PALETTE = ['#1B6B2E', '#10b981', '#f59e0b', '#3D8A4F', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export default function AdminRapports() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchReportsData(supabase);
    setData(result);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) load();
  }, [userRole, load]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent consulter les rapports.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Chargement des statistiques…</div>
    );
  }

  const kpis = computeKpis(data);
  const statusData = abstractsByStatus(data);
  const themeData = abstractsByTheme(data);
  const articleData = articlesByStatus(data);
  const reviewData = reviewsByStatus(data);
  const roleData = usersByRole(data);
  const paymentData = paymentsByStatus(data);
  const revenueData = revenueByTicket(data);
  const countryData = usersByCountry(data);

  const isEmpty =
    kpis.soumissions === 0 && kpis.utilisateurs === 0 && kpis.billetsPayes === 0;

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Rapports &amp; Statistiques</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Vue d&apos;ensemble en temps réel de l&apos;événement.</p>
        </div>
        <button
          type="button"
          onClick={load}
          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          Actualiser
        </button>
      </div>

      {isEmpty && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '14px 18px', borderRadius: '10px', fontSize: '14px' }}>
          Aucune donnée à afficher pour l&apos;instant. Les indicateurs se rempliront au fil des soumissions et des inscriptions.
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
        <KpiCard label="Soumissions" value={kpis.soumissions} accent="#1B6B2E" />
        <KpiCard label="Taux d'acceptation" value={kpis.tauxAcceptation != null ? `${kpis.tauxAcceptation}%` : '—'} accent="#10b981" sub={`${kpis.acceptes} acceptés · ${kpis.rejetes} rejetés`} />
        <KpiCard label="En cours d'évaluation" value={kpis.enCours} accent="#f59e0b" />
        <KpiCard label="Manuscrits" value={kpis.manuscrits} accent="#3D8A4F" />
        <KpiCard label="Évaluations complétées" value={kpis.evaluationsCompletes} accent="#06b6d4" sub={kpis.tauxCompletionEval != null ? `${kpis.tauxCompletionEval}% du total` : undefined} />
        <KpiCard label="Utilisateurs" value={kpis.utilisateurs} accent="#0f172a" sub={`${kpis.evaluateursValides} évaluateurs validés`} />
        <KpiCard label="Billets payés" value={kpis.billetsPayes} accent="#16a34a" />
        <KpiCard label="Revenus" value={formatFcfa(kpis.revenus)} accent="#166534" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        <ChartCard title="Résumés par statut">
          <BarPanel data={statusData} color="#1B6B2E" />
        </ChartCard>

        <ChartCard title="Résumés par thématique">
          <BarPanel data={themeData} color="#3D8A4F" />
        </ChartCard>

        <ChartCard title="Évaluations">
          <PiePanel data={reviewData} />
        </ChartCard>

        <ChartCard title="Manuscrits par statut">
          <BarPanel data={articleData} color="#10b981" />
        </ChartCard>

        <ChartCard title="Utilisateurs par rôle">
          <BarPanel data={roleData} color="#f59e0b" />
        </ChartCard>

        <ChartCard title="Utilisateurs par pays">
          <BarPanel data={countryData} color="#1B6B2E" />
        </ChartCard>

        <ChartCard title="Statut des paiements">
          <PiePanel data={paymentData} />
        </ChartCard>

        <ChartCard title="Revenus par type de billet (FCFA)" wide>
          <BarPanel data={revenueData} color="#16a34a" money />
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string | number; accent: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${accent}` }}>
      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '6px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px 22px', border: '1px solid #e2e8f0', gridColumn: wide ? '1 / -1' : undefined }}>
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '13px' }}>Aucune donnée</div>;
}

function BarPanel({ data, color, money }: { data: ChartDatum[]; color: string; money?: boolean }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
        <Tooltip formatter={(value) => (money ? formatFcfa(Number(value)) : String(value))} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PiePanel({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
