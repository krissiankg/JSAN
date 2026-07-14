"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type EvaluatorRow,
  evaluatorInitials,
  evaluatorStatusLabel,
  fetchEvaluatorsWithEmails,
  formatEvaluatorName,
  rejectEvaluatorCompletely,
  setEvaluatorStatus,
} from '@/lib/evaluators-admin';
import { formatRegistrationDate } from '@/lib/users-admin';

type TabId = 'pending' | 'approved' | 'all';

type ColumnId = 'email' | 'specialite' | 'institution' | 'telephone' | 'statut' | 'inscription';

const COLUMN_OPTIONS: { id: ColumnId; label: string }[] = [
  { id: 'email', label: 'E-mail' },
  { id: 'specialite', label: 'Spécialité' },
  { id: 'institution', label: 'Institution' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'statut', label: 'Statut' },
  { id: 'inscription', label: 'Inscription' },
];

/** Colonnes utiles sans forcer un scroll trop large. */
const DEFAULT_VISIBLE: Record<ColumnId, boolean> = {
  email: true,
  specialite: false,
  institution: false,
  telephone: true,
  statut: true,
  inscription: false,
};

const STORAGE_KEY = 'jsan-evaluators-columns-v3';

const AVATAR_COLORS = ['#0f172a', '#145224', '#0f766e', '#9a3412', '#7c2d12', '#4c1d95', '#155e75'];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function loadVisibleColumns(): Record<ColumnId, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBLE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBLE };
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    return { ...DEFAULT_VISIBLE, ...parsed };
  } catch {
    return { ...DEFAULT_VISIBLE };
  }
}

export default function AdminEvaluateurs() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const [evaluators, setEvaluators] = useState<EvaluatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(DEFAULT_VISIBLE);
  const [columnsReady, setColumnsReady] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  useEffect(() => {
    setVisibleColumns(loadVisibleColumns());
    setColumnsReady(true);
  }, []);

  useEffect(() => {
    if (!columnsReady || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns, columnsReady]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!columnsMenuRef.current?.contains(event.target as Node)) {
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [columnsMenuOpen]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setEvaluators(await fetchEvaluatorsWithEmails());
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur de chargement.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEventStaff(userRole)) loadData();
  }, [userRole, loadData]);

  const visibleCount = useMemo(
    () => COLUMN_OPTIONS.filter((c) => visibleColumns[c.id]).length,
    [visibleColumns]
  );

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Réservé aux organisateurs.</p>
        <Link href="/dashboard" style={{ marginTop: '15px', display: 'inline-block', color: '#1e293b' }}>← Retour</Link>
      </div>
    );
  }

  const matchesSearch = (row: EvaluatorRow) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (row.prenom ?? '').toLowerCase().includes(q)
      || (row.nom ?? '').toLowerCase().includes(q)
      || (row.email ?? '').toLowerCase().includes(q)
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

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    if (approved) setActiveTab('approved');
    setMessage({
      type: 'success',
      text: approved
        ? `${formatEvaluatorName(row)} a été validé comme évaluateur.`
        : `Le compte de ${formatEvaluatorName(row)} est repassé en attente.`,
    });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleReject = async (row: EvaluatorRow) => {
    const label = formatEvaluatorName(row);
    const isPending = row.role === 'pair_en_attente';
    const confirmText = isPending
      ? `Refuser définitivement la candidature de ${label} ?\n\nLe compte repassera en rôle auteur et un e-mail de notification sera envoyé.`
      : `Révoquer définitivement le rôle évaluateur de ${label} ?\n\nLe compte repassera en rôle auteur et un e-mail sera envoyé.`;

    if (!confirm(confirmText)) return;

    setActionLoading(row.id);
    const err = await rejectEvaluatorCompletely(supabase, row.id);
    setActionLoading(null);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setEvaluators((prev) => prev.filter((e) => e.id !== row.id));
    setMessage({
      type: 'success',
      text: isPending
        ? `La candidature de ${label} a été refusée.`
        : `Le rôle évaluateur de ${label} a été révoqué.`,
    });
    setTimeout(() => setMessage(null), 3500);
  };

  const tabStyle = (tab: TabId): React.CSSProperties => ({
    padding: '9px 16px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    background: activeTab === tab ? '#0f172a' : 'transparent',
    color: activeTab === tab ? '#fff' : '#64748b',
  });

  const actionBtn = (variant: 'primary' | 'danger' | 'ghost', busy: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: '7px',
    fontWeight: 600,
    fontSize: '12px',
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
    whiteSpace: 'nowrap',
    ...(variant === 'primary'
      ? { border: 'none', background: '#166534', color: '#fff' }
      : variant === 'danger'
        ? { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' }
        : { border: '1px solid #e2e8f0', background: '#fff', color: '#475569' }),
  });

  const th: React.CSSProperties = {
    padding: '10px 12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontSize: '12px',
    color: '#64748b',
  };

  const td: React.CSSProperties = {
    padding: '12px',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>Gestion des Évaluateurs</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.55 }}>
            Validez, refusez ou suspendez les candidatures au comité de lecture.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '8px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
            {pendingCount} en attente
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
            {approvedCount} validés
          </div>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'visible' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            borderRadius: '14px 14px 0 0',
            position: 'relative',
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button type="button" onClick={() => setActiveTab('pending')} style={tabStyle('pending')}>
              En attente {pendingCount > 0 ? `(${pendingCount})` : ''}
            </button>
            <button type="button" onClick={() => setActiveTab('approved')} style={tabStyle('approved')}>
              Validés ({approvedCount})
            </button>
            <button type="button" onClick={() => setActiveTab('all')} style={tabStyle('all')}>
              Tous ({evaluators.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#fff',
                padding: '8px 12px',
                borderRadius: '10px',
                width: '240px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ marginRight: '8px', color: '#94a3b8', fontSize: '13px' }}>🔍</span>
              <input
                type="text"
                placeholder="Nom, e-mail…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
              />
            </div>

            <div ref={columnsMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setColumnsMenuOpen((open) => !open)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: columnsMenuOpen ? '#0f172a' : '#fff',
                  color: columnsMenuOpen ? '#fff' : '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Colonnes ({visibleCount})
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{columnsMenuOpen ? '▲' : '▼'}</span>
              </button>

              {columnsMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 50,
                    width: '240px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
                    padding: '10px',
                    maxHeight: 'min(70vh, 420px)',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 8px' }}>
                    Colonnes du tableau
                  </div>
                  {COLUMN_OPTIONS.map((col) => (
                    <label
                      key={col.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#334155',
                        background: visibleColumns[col.id] ? '#f8fafc' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.id]}
                        onChange={() => toggleColumn(col.id)}
                        style={{ width: '15px', height: '15px', accentColor: '#0f172a' }}
                      />
                      {col.label}
                    </label>
                  ))}
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '6px', paddingTop: '8px', display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setVisibleColumns({ ...DEFAULT_VISIBLE })}
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Défaut
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleColumns({
                          email: true,
                          specialite: true,
                          institution: true,
                          telephone: true,
                          statut: true,
                          inscription: true,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#0f172a',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Tout
                    </button>
                  </div>
                  <p style={{ margin: '8px 8px 2px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                    Évaluateur et Actions restent toujours visibles.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', padding: '40px 24px', margin: 0 }}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              {searchTerm
                ? 'Aucun résultat pour cette recherche.'
                : activeTab === 'pending'
                  ? 'Aucune candidature en attente.'
                  : activeTab === 'approved'
                    ? 'Aucun évaluateur validé pour le moment.'
                    : 'Aucun compte évaluateur trouvé.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%', borderRadius: '0 0 14px 14px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                  <th
                    style={{
                      ...th,
                      paddingLeft: '16px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: '#fff',
                    }}
                  >
                    Évaluateur
                  </th>
                  {visibleColumns.email && <th style={th}>E-mail</th>}
                  {visibleColumns.specialite && <th style={th}>Spécialité</th>}
                  {visibleColumns.institution && <th style={th}>Institution</th>}
                  {visibleColumns.telephone && <th style={th}>Téléphone</th>}
                  {visibleColumns.statut && <th style={th}>Statut</th>}
                  {visibleColumns.inscription && <th style={th}>Inscription</th>}
                  <th
                    style={{
                      ...th,
                      paddingRight: '16px',
                      textAlign: 'right',
                      position: 'sticky',
                      right: 0,
                      zIndex: 2,
                      background: '#fff',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = evaluatorStatusLabel(row.role);
                  const isPending = row.role === 'pair_en_attente';
                  const busy = actionLoading === row.id;
                  const name = formatEvaluatorName(row);
                  const rowBg = hoveredRow === row.id ? '#f8fafc' : '#fff';

                  return (
                    <tr
                      key={row.id}
                      onMouseEnter={() => setHoveredRow(row.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}
                    >
                      <td
                        style={{
                          ...td,
                          paddingLeft: '16px',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: rowBg,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: avatarColor(row.id),
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {evaluatorInitials(row)}
                          </div>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{name}</span>
                        </div>
                      </td>

                      {visibleColumns.email && (
                        <td style={{ ...td, color: '#1B6B2E' }}>
                          {row.email ? (
                            <a
                              href={`mailto:${row.email}`}
                              title={row.email}
                              style={{
                                color: '#1B6B2E',
                                textDecoration: 'none',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.email}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.specialite && (
                        <td style={{ ...td, color: '#475569' }}>{row.specialite || '—'}</td>
                      )}

                      {visibleColumns.institution && (
                        <td style={{ ...td, color: '#475569' }}>{row.institution || '—'}</td>
                      )}

                      {visibleColumns.telephone && (
                        <td style={{ ...td, color: '#475569' }}>{row.telephone || '—'}</td>
                      )}

                      {visibleColumns.statut && (
                        <td style={td}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: status.bg,
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                      )}

                      {visibleColumns.inscription && (
                        <td style={{ ...td, color: '#64748b' }}>{formatRegistrationDate(row.created_at)}</td>
                      )}

                      <td
                        style={{
                          ...td,
                          paddingRight: '16px',
                          textAlign: 'right',
                          position: 'sticky',
                          right: 0,
                          zIndex: 1,
                          background: rowBg,
                        }}
                      >
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {isPending ? (
                            <>
                              <button type="button" disabled={busy} onClick={() => handleStatusChange(row, true)} style={actionBtn('primary', busy)}>
                                {busy ? '…' : 'Valider'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => handleReject(row)} style={actionBtn('danger', busy)}>
                                {busy ? '…' : 'Refuser'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" disabled={busy} onClick={() => handleStatusChange(row, false)} style={actionBtn('ghost', busy)}>
                                {busy ? '…' : 'Suspendre'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => handleReject(row)} style={actionBtn('danger', busy)}>
                                {busy ? '…' : 'Révoquer'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
        {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        {' · '}masquez des colonnes si l’écran est étroit
      </p>
    </div>
  );
}
