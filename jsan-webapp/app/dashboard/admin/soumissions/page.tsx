"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { abstractStatusStyle, formatScoreDisplay } from '@/lib/abstracts';
import TableScroll from '@/components/dashboard/TableScroll';
import {
  type OrganizerDecision,
  type SubmissionRow,
  type SubmissionTab,
  abstractStatusLabel,
  confidentialNote,
  decisionLabel,
  fetchSubmissionsForStaff,
  matchesSubmissionTab,
  recommendationLabel,
  reviewerDisplayName,
  setSubmissionDecision,
  submissionTabLabel,
} from '@/lib/submissions-admin';
import {
  assignReviewerToAbstract,
  evaluatorOptionLabel,
  fetchValidatedEvaluators,
  unassignReviewer,
} from '@/lib/review-assignments';
import type { EvaluatorRow } from '@/lib/evaluators-admin';
import ManuscriptSubmissionsSection from '@/components/dashboard/ManuscriptSubmissionsSection';

type ViewMode = 'resumes' | 'manuscrits';

function statusBadge(statut: SubmissionRow['statut']) {
  const style = abstractStatusStyle(statut);
  return (
    <span style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: 600, backgroundColor: style.background, color: style.color,
      border: style.border,
    }}>
      {abstractStatusLabel(statut)}
    </span>
  );
}

export default function AdminSoumissions() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<SubmissionTab>('ready');
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [decision, setDecision] = useState<OrganizerDecision | ''>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [evaluators, setEvaluators] = useState<EvaluatorRow[]>([]);
  const [pickEvaluatorId, setPickEvaluatorId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('resumes');

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchSubmissionsForStaff(supabase);
      setSubmissions(data);
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

  const counts = {
    ready: submissions.filter((s) => matchesSubmissionTab(s, 'ready')).length,
    in_progress: submissions.filter((s) => matchesSubmissionTab(s, 'in_progress')).length,
    decided: submissions.filter((s) => matchesSubmissionTab(s, 'decided')).length,
    all: submissions.filter((s) => matchesSubmissionTab(s, 'all')).length,
  };

  const filtered = submissions.filter((row) => {
    if (!matchesSubmissionTab(row, activeTab)) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      row.ref.toLowerCase().includes(q)
      || row.titre.toLowerCase().includes(q)
      || row.authorName.toLowerCase().includes(q)
      || (row.thematique ?? '').toLowerCase().includes(q)
    );
  });

  const openDetail = async (row: SubmissionRow) => {
    setSelected(row);
    setDecision('');
    setPickEvaluatorId('');
    try {
      const evals = await fetchValidatedEvaluators(supabase);
      setEvaluators(evals);
    } catch {
      setEvaluators([]);
    }
  };

  const refreshSelected = async () => {
    const data = await fetchSubmissionsForStaff(supabase);
    setSubmissions(data);
    if (selected) {
      const updated = data.find((s) => s.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  const handleAssign = async () => {
    if (!selected || !pickEvaluatorId) return;
    setAssignLoading(true);
    const err = await assignReviewerToAbstract(supabase, selected.id, pickEvaluatorId);
    setAssignLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setPickEvaluatorId('');
    await refreshSelected();
    setMessage({ type: 'success', text: 'Évaluateur assigné à ce résumé.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUnassign = async (reviewId: string) => {
    setAssignLoading(true);
    const err = await unassignReviewer(supabase, reviewId);
    setAssignLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    await refreshSelected();
    setMessage({ type: 'success', text: 'Assignation retirée.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDecision = async () => {
    if (!selected || !decision) return;
    setActionLoading(true);
    const err = await setSubmissionDecision(supabase, selected.id, decision);
    setActionLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSelected(null);
    setDecision('');
    await loadData();
    setMessage({
      type: 'success',
      text: `${selected.ref} — décision enregistrée : ${decisionLabel(decision)}.`,
    });
    setTimeout(() => setMessage(null), 4000);
  };

  const tabStyle = (tab: SubmissionTab) => ({
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
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px', color: '#111' }}>Gestion des Soumissions</h2>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
            Consultez les évaluations des pairs et prenez la décision finale. Les notes ne sont pas un vote automatique — vous arbitrez en tenant compte des avis et du programme.
          </p>
          <div style={{ display: 'inline-flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => setViewMode('resumes')}
              style={{
                padding: '8px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'resumes' ? '#1e293b' : 'transparent',
                color: viewMode === 'resumes' ? '#fff' : '#64748b',
              }}
            >
              Résumés
            </button>
            <button
              type="button"
              onClick={() => setViewMode('manuscrits')}
              style={{
                padding: '8px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'manuscrits' ? '#C9A010' : 'transparent',
                color: viewMode === 'manuscrits' ? '#fff' : '#64748b',
              }}
            >
              Manuscrits
            </button>
          </div>
        </div>

        {viewMode === 'manuscrits' ? (
          <ManuscriptSubmissionsSection />
        ) : (
        <>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ready', 'in_progress', 'decided', 'all'] as SubmissionTab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
                {submissionTabLabel(tab)}
                {tab === 'ready' && counts.ready > 0 && ` (${counts.ready})`}
                {tab === 'in_progress' && counts.in_progress > 0 && ` (${counts.in_progress})`}
                {tab === 'decided' && counts.decided > 0 && ` (${counts.decided})`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '24px', width: '280px', border: '1px solid #f1f5f9' }}>
            <span style={{ marginRight: '8px', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher une soumission..."
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
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {activeTab === 'ready'
                ? 'Aucune soumission avec évaluation complète en attente de décision.'
                : activeTab === 'in_progress'
                  ? 'Aucune soumission en cours d\'évaluation.'
                  : 'Aucune soumission dans cette catégorie.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TableScroll minWidth={880}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ paddingBottom: '12px', fontWeight: 600 }}>ID</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Titre & Thématique</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Auteur</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600, textAlign: 'center' }}>Évaluations</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600, textAlign: 'center' }}>Pertinence</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600, textAlign: 'center' }}>Qualité</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Statut</th>
                  <th style={{ paddingBottom: '12px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 0', color: '#475569', fontWeight: 600, fontSize: '13px' }}>{row.ref}</td>
                    <td style={{ padding: '16px 12px 16px 0', maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', lineHeight: 1.4, marginBottom: '4px' }}>{row.titre}</div>
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{row.thematique ?? '—'}</span>
                    </td>
                    <td style={{ padding: '16px 12px 16px 0', fontSize: '13px', color: '#475569' }}>
                      <div style={{ fontWeight: 500 }}>{row.authorName}</div>
                      {row.authorInstitution && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{row.authorInstitution}</div>
                      )}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                      {row.completedReviewCount}/{row.reviews.length}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {formatScoreDisplay(row.avgPertinence)}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {formatScoreDisplay(row.avgQualite)}
                    </td>
                    <td style={{ padding: '16px 0' }}>{statusBadge(row.statut)}</td>
                    <td style={{ padding: '16px 0', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', border: 'none',
                          background: '#1B6B2E', color: '#fff', fontWeight: 600,
                          fontSize: '13px', cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(27,107,46,0.2)',
                        }}
                      >
                        Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScroll>
          </div>
        )}
        </>
        )}
      </div>

      {/* Modale décision résumés */}
      {viewMode === 'resumes' && selected && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#f8fafc', borderRadius: '20px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '20px 30px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Décision du comité</h3>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  {selected.ref} • {selected.authorName} • {statusBadge(selected.statut)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{selected.titre}</h4>
              {selected.thematique && (
                <span style={{ display: 'inline-block', background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
                  {selected.thematique}
                </span>
              )}
              {selected.contenu_texte && (
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
                  {selected.contenu_texte}
                </p>
              )}

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Évaluateurs assignés ({selected.reviews.length})
                </h4>
                {selected.reviews.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {selected.reviews.map((rev) => (
                      <div key={rev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#334155' }}>{reviewerDisplayName(rev)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {rev.statut === 'Complete' ? 'Évalué' : 'En attente'}
                          </span>
                          {rev.statut !== 'Complete' && (
                            <button
                              type="button"
                              disabled={assignLoading}
                              onClick={() => handleUnassign(rev.id)}
                              style={{ fontSize: '12px', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Retirer
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>Aucun évaluateur assigné pour le moment.</p>
                )}
                {(selected.statut === 'Soumis' || selected.statut === 'En_Evaluation' || selected.statut === 'A_Reviser') && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                      value={pickEvaluatorId}
                      onChange={(e) => setPickEvaluatorId(e.target.value)}
                      style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="">— Choisir un évaluateur —</option>
                      {evaluators
                        .filter((ev) => !selected.reviews.some((r) => r.reviewer_id === ev.id))
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>{evaluatorOptionLabel(ev)}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!pickEvaluatorId || assignLoading}
                      onClick={handleAssign}
                      style={{
                        padding: '10px 18px', borderRadius: '8px', border: 'none',
                        background: '#1B6B2E', color: '#fff', fontWeight: 600, fontSize: '13px',
                        cursor: pickEvaluatorId && !assignLoading ? 'pointer' : 'not-allowed',
                        opacity: pickEvaluatorId && !assignLoading ? 1 : 0.6,
                      }}
                    >
                      {assignLoading ? '…' : 'Assigner'}
                    </button>
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Avis des évaluateurs ({selected.completedReviewCount} complète{selected.completedReviewCount > 1 ? 's' : ''})
              </h4>

              {selected.reviews.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Aucune évaluation reçue pour le moment.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                  {selected.reviews.map((rev) => {
                    const scores = rev.scores ?? {};
                    const conf = confidentialNote(rev);
                    return (
                      <div key={rev.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ fontSize: '14px', color: '#1e293b' }}>{reviewerDisplayName(rev)}</strong>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px',
                            background: rev.statut === 'Complete' ? '#dcfce7' : '#fef3c7',
                            color: rev.statut === 'Complete' ? '#166534' : '#b45309',
                          }}>
                            {rev.statut === 'Complete' ? 'Évaluation complète' : 'En cours'}
                          </span>
                        </div>
                        {rev.statut === 'Complete' && (
                          <>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                              {typeof scores.originalite === 'number' && <span>Originalité : <strong>{scores.originalite}/5</strong></span>}
                              {typeof scores.methodologie === 'number' && <span>Méthodologie : <strong>{scores.methodologie}/5</strong></span>}
                              {typeof scores.pertinence === 'number' && <span>Pertinence : <strong>{scores.pertinence}/5</strong></span>}
                              {typeof scores.qualite === 'number' && <span>Qualité : <strong>{scores.qualite}/5</strong></span>}
                            </div>
                            {scores.recommandation && (
                              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#334155' }}>
                                <strong>Recommandation :</strong> {recommendationLabel(scores.recommandation)}
                              </p>
                            )}
                            {rev.commentaires_auteurs && (
                              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }}>
                                « {rev.commentaires_auteurs} »
                              </p>
                            )}
                            {conf && (
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                <strong>Note confidentielle :</strong> {conf}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(selected.statut === 'Soumis' || selected.statut === 'En_Evaluation' || selected.statut === 'A_Reviser') && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Votre décision finale</h4>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                    Les moyennes affichées sont indicatives. C&apos;est vous qui tranchez au nom du comité scientifique.
                  </p>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as OrganizerDecision | '')}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '16px' }}
                  >
                    <option value="">— Choisir une décision —</option>
                    <option value="Accepte">✅ Accepter le résumé</option>
                    <option value="A_Reviser">⚠️ Demander une révision à l&apos;auteur</option>
                    <option value="Rejete">❌ Refuser le résumé</option>
                  </select>
                  <button
                    type="button"
                    disabled={!decision || actionLoading}
                    onClick={handleDecision}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                      background: '#111827', color: '#fff', fontWeight: 600, fontSize: '15px',
                      cursor: decision && !actionLoading ? 'pointer' : 'not-allowed',
                      opacity: decision && !actionLoading ? 1 : 0.6,
                    }}
                  >
                    {actionLoading ? 'Enregistrement…' : 'Confirmer la décision'}
                  </button>
                </div>
              )}

              {(selected.statut === 'Accepte' || selected.statut === 'Rejete') && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '14px', color: '#64748b' }}>
                  Décision déjà enregistrée : <strong>{abstractStatusLabel(selected.statut)}</strong>.
                  Vous pouvez rouvrir une révision en changeant le statut manuellement si nécessaire.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
