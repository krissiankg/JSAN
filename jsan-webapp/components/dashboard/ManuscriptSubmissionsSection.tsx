"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatScoreDisplay } from '@/lib/abstracts';
import { fullArticleStatusStyle } from '@/lib/full-articles';
import { getArticleFileSignedUrl } from '@/lib/article-files';
import {
  type ManuscriptDecision,
  type ManuscriptRow,
  type ManuscriptTab,
  confidentialNote,
  fetchManuscriptsForStaff,
  fullArticleStatusLabel,
  manuscriptDecisionLabel,
  manuscriptTabLabel,
  matchesManuscriptTab,
  recommendationLabel,
  reviewerDisplayName,
  setManuscriptDecision,
} from '@/lib/manuscripts-admin';
import {
  assignReviewerToAbstract,
  evaluatorOptionLabel,
  fetchValidatedEvaluators,
  unassignReviewer,
} from '@/lib/review-assignments';
import type { EvaluatorRow } from '@/lib/evaluators-admin';

function manuscriptBadge(statut: ManuscriptRow['statut']) {
  const style = fullArticleStatusStyle(statut);
  return (
    <span style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: 600, backgroundColor: style.background, color: style.color,
    }}>
      {fullArticleStatusLabel(statut)}
    </span>
  );
}

export default function ManuscriptSubmissionsSection() {
  const supabase = createClient();

  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ManuscriptTab>('ready');
  const [selected, setSelected] = useState<ManuscriptRow | null>(null);
  const [decision, setDecision] = useState<ManuscriptDecision | ''>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [evaluators, setEvaluators] = useState<EvaluatorRow[]>([]);
  const [pickEvaluatorId, setPickEvaluatorId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchManuscriptsForStaff(supabase);
      setManuscripts(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement.';
      const hint = msg.includes('full_articles') ? ' Exécutez la migration 012 dans Supabase.' : '';
      setMessage({ type: 'error', text: `${msg}${hint}` });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = {
    ready: manuscripts.filter((m) => matchesManuscriptTab(m, 'ready')).length,
    in_progress: manuscripts.filter((m) => matchesManuscriptTab(m, 'in_progress')).length,
    decided: manuscripts.filter((m) => matchesManuscriptTab(m, 'decided')).length,
  };

  const filtered = manuscripts.filter((row) => {
    if (!matchesManuscriptTab(row, activeTab)) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      row.ref.toLowerCase().includes(q)
      || row.titre.toLowerCase().includes(q)
      || row.authorName.toLowerCase().includes(q)
      || (row.thematique ?? '').toLowerCase().includes(q)
    );
  });

  const openDetail = async (row: ManuscriptRow) => {
    setSelected(row);
    setDecision('');
    setPickEvaluatorId('');
    try {
      setEvaluators(await fetchValidatedEvaluators(supabase));
    } catch {
      setEvaluators([]);
    }
  };

  const refreshSelected = async () => {
    const data = await fetchManuscriptsForStaff(supabase);
    setManuscripts(data);
    if (selected) {
      const updated = data.find((m) => m.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  const handleAssign = async () => {
    if (!selected || !pickEvaluatorId) return;
    setAssignLoading(true);
    const err = await assignReviewerToAbstract(supabase, selected.abstractId, pickEvaluatorId);
    setAssignLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    await supabase
      .from('full_articles')
      .update({ statut: 'En_Evaluation', updated_at: new Date().toISOString() })
      .eq('id', selected.id)
      .eq('statut', 'Soumis');
    setPickEvaluatorId('');
    await refreshSelected();
    setMessage({ type: 'success', text: 'Évaluateur assigné au manuscrit.' });
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
    const err = await setManuscriptDecision(supabase, selected.id, decision);
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
      text: `${selected.ref} — ${manuscriptDecisionLabel(decision)}.`,
    });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDownload = async () => {
    if (!selected?.filePath) return;
    const url = await getArticleFileSignedUrl(supabase, selected.filePath);
    if (url) window.open(url, '_blank');
  };

  const tabStyle = (tab: ManuscriptTab) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600 as const,
    background: activeTab === tab ? '#1B6B2E' : '#f1f5f9',
    color: activeTab === tab ? '#fff' : '#64748b',
  });

  return (
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
          {(['ready', 'in_progress', 'decided', 'all'] as ManuscriptTab[]).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {manuscriptTabLabel(tab)}
              {tab === 'ready' && counts.ready > 0 && ` (${counts.ready})`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '24px', width: '280px', border: '1px solid #f1f5f9' }}>
          <span style={{ marginRight: '8px', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher un manuscrit..."
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
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📑</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Aucun manuscrit dans cette catégorie.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
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
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#f3e8ff', padding: '4px 8px', borderRadius: '4px' }}>{row.thematique ?? '—'}</span>
                  </td>
                  <td style={{ padding: '16px 12px 16px 0', fontSize: '13px', color: '#475569' }}>{row.authorName}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                    {row.completedReviewCount}/{row.reviews.length}
                  </td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>{formatScoreDisplay(row.avgPertinence)}</td>
                  <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>{formatScoreDisplay(row.avgQualite)}</td>
                  <td style={{ padding: '16px 0' }}>{manuscriptBadge(row.statut)}</td>
                  <td style={{ padding: '16px 0', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none',
                        background: '#3D8A4F', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(139,92,246,0.2)',
                      }}
                    >
                      Examiner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#f8fafc', borderRadius: '20px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '20px 30px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Décision sur le manuscrit</h3>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  {selected.ref} • {selected.authorName} • {manuscriptBadge(selected.statut)}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{selected.titre}</h4>
              {selected.fileName && (
                <button type="button" onClick={handleDownload} style={{ marginBottom: '20px', padding: '10px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  ⬇️ Télécharger {selected.fileName}
                </button>
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
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{rev.statut === 'Complete' ? 'Évalué' : 'En attente'}</span>
                          {rev.statut !== 'Complete' && (
                            <button type="button" disabled={assignLoading} onClick={() => handleUnassign(rev.id)} style={{ fontSize: '12px', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>Retirer</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>Aucun évaluateur assigné.</p>
                )}
                {(selected.statut === 'Soumis' || selected.statut === 'En_Evaluation') && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select value={pickEvaluatorId} onChange={(e) => setPickEvaluatorId(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                      <option value="">— Choisir un évaluateur —</option>
                      {evaluators.filter((ev) => !selected.reviews.some((r) => r.reviewer_id === ev.id)).map((ev) => (
                        <option key={ev.id} value={ev.id}>{evaluatorOptionLabel(ev)}</option>
                      ))}
                    </select>
                    <button type="button" disabled={!pickEvaluatorId || assignLoading} onClick={handleAssign} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#3D8A4F', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: pickEvaluatorId ? 1 : 0.6 }}>
                      Assigner
                    </button>
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Avis des évaluateurs ({selected.completedReviewCount} complète{selected.completedReviewCount > 1 ? 's' : ''})
              </h4>
              {selected.reviews.filter((r) => r.statut === 'Complete').length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Aucune évaluation complète pour le moment.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                  {selected.reviews.filter((r) => r.statut === 'Complete').map((rev) => {
                    const scores = rev.scores ?? {};
                    const conf = confidentialNote(rev);
                    return (
                      <div key={rev.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <strong style={{ fontSize: '14px', color: '#1e293b' }}>{reviewerDisplayName(rev)}</strong>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569', margin: '8px 0' }}>
                          {typeof scores.originalite === 'number' && <span>Structure : <strong>{scores.originalite}/5</strong></span>}
                          {typeof scores.methodologie === 'number' && <span>Données : <strong>{scores.methodologie}/5</strong></span>}
                          {typeof scores.pertinence === 'number' && <span>Discussion : <strong>{scores.pertinence}/5</strong></span>}
                        </div>
                        {typeof scores.recommandation === 'string' && scores.recommandation && (
                          <p style={{ margin: '0 0 8px', fontSize: '13px' }}><strong>Recommandation :</strong> {recommendationLabel(scores.recommandation)}</p>
                        )}
                        {rev.commentaires_auteurs && (
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>« {rev.commentaires_auteurs} »</p>
                        )}
                        {conf && (
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                            <strong>Note confidentielle :</strong> {conf}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(selected.statut === 'Soumis' || selected.statut === 'En_Evaluation') && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Décision finale — publication aux actes</h4>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                    Les notes sont indicatives. Vous arbitrez la publication au nom du comité.
                  </p>
                  <select value={decision} onChange={(e) => setDecision(e.target.value as ManuscriptDecision | '')} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '16px' }}>
                    <option value="">— Choisir une décision —</option>
                    <option value="Accepte">✅ Accepter pour publication aux actes</option>
                    <option value="Soumis">⚠️ Demander des corrections à l&apos;auteur</option>
                    <option value="Rejete">❌ Refuser la publication</option>
                  </select>
                  <button type="button" disabled={!decision || actionLoading} onClick={handleDecision} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#3D8A4F', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: decision ? 'pointer' : 'not-allowed', opacity: decision ? 1 : 0.6 }}>
                    {actionLoading ? 'Enregistrement…' : 'Confirmer la décision'}
                  </button>
                </div>
              )}

              {(selected.statut === 'Accepte' || selected.statut === 'Rejete' || selected.statut === 'Publie') && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '14px', color: '#64748b' }}>
                  Décision enregistrée : <strong>{fullArticleStatusLabel(selected.statut)}</strong>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
