"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { getAbstractFileSignedUrl } from '@/lib/abstract-files';
import {
  type AssignedAbstract,
  fetchAssignedAbstracts,
  submitAbstractReview,
} from '@/lib/evaluations';

export default function ResumesAEvaluer() {
  const { userRole, user } = useAuth();
  const supabase = createClient();

  const [resumesAssigned, setResumesAssigned] = useState<AssignedAbstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedResume, setSelectedResume] = useState<AssignedAbstract | null>(null);
  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(0);
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssignedAbstracts(supabase, user.id);
      setResumesAssigned(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement.';
      const hint = msg.includes('reviews') ? ' Exécutez la migration 008 dans Supabase.' : '';
      setError(`${msg}${hint}`);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (userRole === 'pair' || isEventStaff(userRole)) loadData();
  }, [userRole, loadData]);

  const openModal = (resume: AssignedAbstract) => {
    const s = (resume.myReview?.scores ?? {}) as Record<string, unknown>;
    setC1(typeof s.originalite === 'number' ? s.originalite : 0);
    setC2(typeof s.methodologie === 'number' ? s.methodologie : 0);
    setC3(typeof s.pertinence === 'number' ? s.pertinence : 0);
    setComment(resume.myReview?.commentaires_auteurs ?? '');
    setRecommendation(typeof s.recommandation === 'string' ? s.recommandation : '');
    setSelectedResume(resume);
  };

  const handleDownload = async () => {
    if (!selectedResume?.filePath) return;
    setDownloading(true);
    const url = await getAbstractFileSignedUrl(supabase, selectedResume.filePath);
    setDownloading(false);
    if (url) window.open(url, '_blank');
  };

  const handleSubmit = async () => {
    if (!selectedResume || !user) return;
    setSubmitting(true);
    const err = await submitAbstractReview(supabase, {
      abstractId: selectedResume.id,
      reviewerId: user.id,
      existingReviewId: selectedResume.myReview?.id ?? null,
      values: { critere1: c1, critere2: c2, critere3: c3, commentaire: comment, recommandation: recommendation },
      complete: true,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setSelectedResume(null);
    await loadData();
  };

  // Sécurité
  if (userRole !== 'pair' && !isEventStaff(userRole)) {
    return <div style={{ padding: '20px', color: '#dc2626' }}>Accès non autorisé. Cette page est réservée aux évaluateurs.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header */}
      <div>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Voici la liste des résumés qui vous ont été assignés par le comité scientifique. Veuillez soumettre votre évaluation avant la date limite.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '14px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Tableau des résumés assignés */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ paddingBottom: '12px', fontWeight: 600, width: '10%' }}>ID</th>
              <th style={{ paddingBottom: '12px', fontWeight: 600, width: '35%' }}>Titre & Thématique</th>
              <th style={{ paddingBottom: '12px', fontWeight: 600, width: '15%' }}>Date Limite</th>
              <th style={{ paddingBottom: '12px', fontWeight: 600, width: '15%' }}>Statut</th>
              <th style={{ paddingBottom: '12px', fontWeight: 600, textAlign: 'right', width: '25%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {resumesAssigned.map((resume) => (
              <tr key={resume.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px 0', color: '#475569', fontWeight: 600, fontSize: '13px' }}>
                  {resume.ref}
                </td>
                <td style={{ padding: '16px 0', paddingRight: '15px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.4, fontSize: '14px', marginBottom: '4px' }}>{resume.title}</div>
                  <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{resume.thematic}</span>
                </td>
                <td style={{ padding: '16px 0', color: '#475569', fontSize: '13px' }}>
                  {resume.deadline}
                </td>
                <td style={{ padding: '16px 0' }}>
                  <span style={{ 
                    background: resume.status === 'Évalué' ? '#dcfce7' : resume.status === 'En cours' ? '#fef3c7' : '#f1f5f9', 
                    color: resume.status === 'Évalué' ? '#166534' : resume.status === 'En cours' ? '#b45309' : '#475569', 
                    padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 
                  }}>
                    {resume.status}
                  </span>
                </td>
                <td style={{ padding: '16px 0', textAlign: 'right' }}>
                  <button 
                    onClick={() => openModal(resume)}
                    style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '8px', 
                      background: resume.status === 'Évalué' ? '#f8fafc' : '#2563eb', 
                      color: resume.status === 'Évalué' ? '#64748b' : '#ffffff', 
                      border: resume.status === 'Évalué' ? '1px solid #cbd5e1' : 'none',
                      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px', 
                      boxShadow: resume.status === 'Évalué' ? 'none' : '0 4px 10px rgba(37,99,235,0.2)' 
                    }}
                  >
                    <span>{resume.status === 'Évalué' ? '👁️' : '✍️'}</span>
                    {resume.status === 'Évalué' ? 'Voir l\'évaluation' : 'Examiner et Noter'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && resumesAssigned.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px' }}>
            Aucun résumé ne vous a été assigné pour le moment.
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px' }}>
            Chargement des résumés…
          </div>
        )}
      </div>

      {/* MODALE D'ÉVALUATION */}
      {selectedResume && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#f8fafc', borderRadius: '20px', width: '100%', maxWidth: '1000px', height: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 30px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Processus d'Évaluation</h3>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{selectedResume.ref} • Mode Double Aveugle</div>
              </div>
              <button 
                onClick={() => setSelectedResume(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Split Screen) */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Panneau Gauche : Lecture du résumé */}
              <div style={{ flex: '1', background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '30px', overflowY: 'auto' }}>
                <span style={{ display: 'inline-block', background: '#e0e7ff', color: '#4338ca', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '20px' }}>
                  Thématique : {selectedResume.thematic}
                </span>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '20px', lineHeight: 1.3 }}>
                  {selectedResume.title}
                </h2>
                
                <div style={{ height: '2px', background: '#f1f5f9', width: '100%', marginBottom: '20px' }}></div>
                
                <h4 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '1px', marginBottom: '10px' }}>Corps du Résumé</h4>
                <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.8, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                  {selectedResume.abstractText}
                </p>

                {/* Fichier joint (optionnel) */}
                {selectedResume.filePath && (
                  <div style={{ marginTop: '30px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        📎
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{selectedResume.fileName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{(selectedResume.fileType ?? 'PDF').toUpperCase()}</div>
                      </div>
                    </div>
                    <button onClick={handleDownload} disabled={downloading} style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <span>⬇️</span> {downloading ? '...' : 'Télécharger'}
                    </button>
                  </div>
                )}
              </div>

              {/* Panneau Droit : Grille de notation */}
              <div style={{ flex: '0 0 400px', background: '#f8fafc', padding: '30px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>Grille de Notation</h3>
                
                {/* Critères */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Originalité & Innovation</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{c1} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c1} onChange={(e) => setC1(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Rigueur Méthodologique</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{c2} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c2} onChange={(e) => setC2(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Pertinence au Thème</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{c3} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c3} onChange={(e) => setC3(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Commentaires */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Commentaire constructif (visible par l'auteur)</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Saisissez vos retours pour aider l'auteur..."
                    style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'none', fontFamily: 'inherit' }}
                  ></textarea>
                </div>

                {/* Recommandation finale */}
                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Recommandation du comité</label>
                  <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}>
                    <option value="">-- Sélectionnez une décision --</option>
                    <option value="accept">✅ Accepter sans modification</option>
                    <option value="accept_minor">⚠️ Accepter avec corrections mineures</option>
                    <option value="reject">❌ Refuser</option>
                  </select>
                </div>

                {/* Bouton de soumission */}
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ width: '100%', background: '#111827', color: '#fff', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '15px', cursor: submitting ? 'wait' : 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Envoi en cours…' : 'Soumettre l\'évaluation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
