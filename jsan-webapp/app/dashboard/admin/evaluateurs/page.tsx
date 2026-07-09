"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type EvaluatorRow,
  evaluatorStatusLabel,
  fetchEvaluators,
  formatEvaluatorName,
  setEvaluatorStatus,
} from '@/lib/evaluators-admin';
import { formatRegistrationDate } from '@/lib/users-admin';

type TabId = 'pending' | 'approved' | 'all';

export default function AdminEvaluateurs() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [evaluators, setEvaluators] = useState<EvaluatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchEvaluators(supabase);
      setEvaluators(data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur de chargement.' });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) loadData();
  }, [userRole, loadData]);

  if (!isEventStaff(userRole)) {
    return (
      <div className="dashboard-content">
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ margin: '0 0 8px' }}>Accès refusé</h2>
          <p style={{ margin: 0 }}>Cette page est réservée aux organisateurs.</p>
          <Link href="/dashboard" style={{ marginTop: '15px', display: 'inline-block', color: '#1e293b' }}>← Retour</Link>
        </div>
      </div>
    );
  }

  const matchesSearch = (row: EvaluatorRow) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      (row.prenom ?? '').toLowerCase().includes(q)
      || (row.nom ?? '').toLowerCase().includes(q)
      || (row.specialite ?? '').toLowerCase().includes(q)
      || (row.institution ?? '').toLowerCase().includes(q)
      || (row.telephone ?? '').toLowerCase().includes(q)
    );
  };

  const filtered = evaluators.filter((row) => {
    if (!matchesSearch(row)) return false;
    if (activeTab === 'pending') return row.role === 'pair_en_attente';
    if (activeTab === 'approved') return row.role === 'pair_valide';
    return true;
  });

  const pendingCount = evaluators.filter((e) => e.role === 'pair_en_attente').length;
  const approvedCount = evaluators.filter((e) => e.role === 'pair_valide').length;

  const handleStatusChange = async (row: EvaluatorRow, approved: boolean) => {
    setActionLoading(row.id);
    const err = await setEvaluatorStatus(supabase, row.id, approved);
    setActionLoading(null);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setEvaluators((prev) =>
      prev.map((e) => (e.id === row.id ? { ...e, role: approved ? 'pair_valide' : 'pair_en_attente' } : e))
    );
    setMessage({
      type: 'success',
      text: approved
        ? `${formatEvaluatorName(row)} a été validé comme évaluateur.`
        : `Le compte de ${formatEvaluatorName(row)} est repassé en attente.`,
    });
    setTimeout(() => setMessage(null), 3500);
  };

  const tabStyle = (tab: TabId) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600 as const,
    background: activeTab === tab ? '#1e293b' : '#f1f5f9',
    color: activeTab === tab ? '#fff' : '#64748b',
  });

  return (
    <div className="dashboard-content" style={{ minHeight: '100vh', padding: '10px 0' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px', color: '#111' }}>Gestion des Évaluateurs</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Validez les candidatures au comité de lecture et gérez les comptes évaluateurs actifs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#fef3c7', color: '#b45309', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
              {pendingCount} en attente
            </div>
            <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
              {approvedCount} validés
            </div>
          </div>
        </div>

        {message && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => setActiveTab('pending')} style={tabStyle('pending')}>
              En attente {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button type="button" onClick={() => setActiveTab('approved')} style={tabStyle('approved')}>
              Validés ({approvedCount})
            </button>
            <button type="button" onClick={() => setActiveTab('all')} style={tabStyle('all')}>
              Tous
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '24px', width: '280px', border: '1px solid #f1f5f9' }}>
            <span style={{ marginRight: '8px', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher un évaluateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', padding: '24px 0' }}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {activeTab === 'pending'
                ? 'Aucune candidature évaluateur en attente.'
                : activeTab === 'approved'
                  ? 'Aucun évaluateur validé pour le moment.'
                  : 'Aucun compte évaluateur trouvé.'}
            </p>
            {activeTab === 'pending' && (
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#b45309' }}>
                Compte test : <code>evaluateur-attente@jsan-test.com</code>
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '12px' }}>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Évaluateur</th>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Spécialité</th>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Institution</th>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Téléphone</th>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Statut</th>
                  <th style={{ padding: '16px', fontWeight: 500 }}>Inscription</th>
                  <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = evaluatorStatusLabel(row.role);
                  const isPending = row.role === 'pair_en_attente';
                  const busy = actionLoading === row.id;
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formatEvaluatorName(row))}&background=random&color=fff&size=80`}
                            alt=""
                            style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                          />
                          <div style={{ fontWeight: 600, color: '#111', fontSize: '14px' }}>{formatEvaluatorName(row)}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{row.specialite ?? '—'}</td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{row.institution ?? '—'}</td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{row.telephone ?? '—'}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-flex', padding: '4px 10px', borderRadius: '20px',
                          fontSize: '12px', fontWeight: 600, backgroundColor: status.bg, color: status.color,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>
                        {formatRegistrationDate(row.created_at)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        {isPending ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleStatusChange(row, true)}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', border: 'none',
                              background: '#166534', color: '#fff', fontWeight: 600,
                              cursor: busy ? 'wait' : 'pointer', fontSize: '13px', opacity: busy ? 0.7 : 1,
                            }}
                          >
                            {busy ? '…' : 'Valider'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleStatusChange(row, false)}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                              background: '#fff', color: '#64748b', fontWeight: 500,
                              cursor: busy ? 'wait' : 'pointer', fontSize: '13px', opacity: busy ? 0.7 : 1,
                            }}
                          >
                            {busy ? '…' : 'Suspendre'}
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

        <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
          <strong style={{ color: '#334155' }}>Comptes de test</strong> (mot de passe : <code>Test@JSAN2025</code>)
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><code>evaluateur@jsan-test.com</code> — évaluateur validé (<code>pair_valide</code>)</li>
            <li><code>evaluateur-attente@jsan-test.com</code> — candidature en attente (<code>pair_en_attente</code>)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
