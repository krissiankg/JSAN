"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { getArticleFileSignedUrl } from '@/lib/article-files';
import {
  type AssignedArticle,
  fetchAssignedArticles,
  submitAbstractReview,
} from '@/lib/evaluations';
import { fetchDoubleBlindEnabled } from '@/lib/review-mode';
import TableScroll from '@/components/dashboard/TableScroll';

export default function ArticlesAEvaluer() {
  const { userRole, user } = useAuth();
  const supabase = createClient();

  const [articlesAssigned, setArticlesAssigned] = useState<AssignedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doubleBlind, setDoubleBlind] = useState(true);

  const [selectedArticle, setSelectedArticle] = useState<AssignedArticle | null>(null);
  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(0);
  const [comment, setComment] = useState('');
  const [confidential, setConfidential] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [data, blind] = await Promise.all([
        fetchAssignedArticles(supabase, user.id),
        fetchDoubleBlindEnabled(supabase),
      ]);
      setArticlesAssigned(data);
      setDoubleBlind(blind);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement.';
      const hint = msg.includes('full_articles') ? ' Exécutez la migration 012 dans Supabase.' : '';
      setError(`${msg}${hint}`);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (userRole === 'pair' || isEventStaff(userRole)) loadData();
  }, [userRole, loadData]);

  const openModal = (article: AssignedArticle) => {
    const s = (article.myReview?.scores ?? {}) as Record<string, unknown>;
    setC1(typeof s.originalite === 'number' ? s.originalite : 0);
    setC2(typeof s.methodologie === 'number' ? s.methodologie : 0);
    setC3(typeof s.pertinence === 'number' ? s.pertinence : 0);
    setComment(article.myReview?.commentaires_auteurs ?? '');
    setConfidential(
      article.myReview?.commentaires_admin_secrets
      ?? (typeof s.commentaires_confidentiels === 'string' ? s.commentaires_confidentiels : '')
    );
    setRecommendation(typeof s.recommandation === 'string' ? s.recommandation : '');
    setSelectedArticle(article);
  };

  const handleDownload = async () => {
    if (!selectedArticle?.filePath) return;
    setDownloading(true);
    const url = await getArticleFileSignedUrl(supabase, selectedArticle.filePath);
    setDownloading(false);
    if (url) window.open(url, '_blank');
  };

  const handleSubmit = async () => {
    if (!selectedArticle || !user) return;
    setSubmitting(true);
    const err = await submitAbstractReview(supabase, {
      abstractId: selectedArticle.abstractId,
      reviewerId: user.id,
      existingReviewId: selectedArticle.myReviewId,
      values: {
        critere1: c1, critere2: c2, critere3: c3,
        commentaire: comment, recommandation: recommendation,
        commentairesConfidentiels: confidential,
      },
      complete: true,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setSelectedArticle(null);
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
          Suite à l'acceptation des résumés, voici la liste des articles complets (manuscrits) qui vous ont été soumis pour l'évaluation finale.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '14px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Tableau des articles assignés */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        <TableScroll minWidth={720}>
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
            {articlesAssigned.map((article) => (
              <tr key={article.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px 0', color: '#475569', fontWeight: 600, fontSize: '13px' }}>
                  {article.ref}
                </td>
                <td style={{ padding: '16px 0', paddingRight: '15px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.4, fontSize: '14px', marginBottom: '4px' }}>{article.title}</div>
                  <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{article.thematic}</span>
                </td>
                <td style={{ padding: '16px 0', color: '#475569', fontSize: '13px' }}>
                  {article.deadline}
                </td>
                <td style={{ padding: '16px 0' }}>
                  <span style={{ 
                    background: article.status === 'Évalué' ? '#dcfce7' : article.status === 'En cours' ? '#fef3c7' : '#f1f5f9', 
                    color: article.status === 'Évalué' ? '#166534' : article.status === 'En cours' ? '#b45309' : '#475569', 
                    padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 
                  }}>
                    {article.status}
                  </span>
                </td>
                <td style={{ padding: '16px 0', textAlign: 'right' }}>
                  <button 
                    onClick={() => openModal(article)}
                    style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '8px', 
                      background: article.status === 'Évalué' ? '#f8fafc' : '#3D8A4F', 
                      color: article.status === 'Évalué' ? '#64748b' : '#ffffff', 
                      border: article.status === 'Évalué' ? '1px solid #cbd5e1' : 'none',
                      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px', 
                      boxShadow: article.status === 'Évalué' ? 'none' : '0 4px 10px rgba(139,92,246,0.2)' 
                    }}
                  >
                    <span>{article.status === 'Évalué' ? '👁️' : '📋'}</span>
                    {article.status === 'Évalué' ? 'Voir l\'évaluation' : 'Évaluer le manuscrit'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroll>

        {!loading && articlesAssigned.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px' }}>
            Aucun manuscrit ne vous a été assigné pour le moment.
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px' }}>
            Chargement des manuscrits…
          </div>
        )}
      </div>

      {/* MODALE D'ÉVALUATION D'ARTICLE COMPLET */}
      {selectedArticle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#f8fafc', borderRadius: '20px', width: '100%', maxWidth: '1000px', height: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 30px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Évaluation du Manuscrit Complet</h3>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  {selectedArticle.ref}
                  {' • '}
                  {doubleBlind || !selectedArticle.authorLabel
                    ? 'Mode double aveugle (auteur anonyme)'
                    : `Auteur : ${selectedArticle.authorLabel}`}
                </div>
              </div>
              <button 
                onClick={() => setSelectedArticle(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Split Screen) */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Panneau Gauche : Fichier à télécharger */}
              <div style={{ flex: '1', background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <span style={{ display: 'inline-block', background: '#f3e8ff', color: '#7e22ce', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '20px', width: 'fit-content' }}>
                  Thématique : {selectedArticle.thematic}
                </span>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '20px', lineHeight: 1.3 }}>
                  {selectedArticle.title}
                </h2>
                
                <div style={{ height: '2px', background: '#f1f5f9', width: '100%', marginBottom: '20px' }}></div>
                
                <h4 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '1px', marginBottom: '20px' }}>Document à évaluer</h4>
                
                <div style={{ padding: '30px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1 }}>
                  <div style={{ width: '80px', height: '80px', background: '#e2e8f0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', marginBottom: '20px' }}>
                    📑
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>{selectedArticle.fileName ?? 'Aucun fichier'}</div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
                    {(doubleBlind || !selectedArticle.authorLabel) ? 'Document anonymisé' : `Auteur : ${selectedArticle.authorLabel}`}
                    {' • '}
                    {selectedArticle.fileSize}
                  </div>
                  
                  <button onClick={handleDownload} disabled={downloading || !selectedArticle.filePath} style={{ padding: '12px 24px', background: '#111827', borderRadius: '8px', color: '#ffffff', fontWeight: 600, fontSize: '15px', cursor: selectedArticle.filePath ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: 'none', opacity: selectedArticle.filePath ? 1 : 0.5 }}>
                    <span>⬇️</span> {downloading ? '...' : 'Télécharger le manuscrit'}
                  </button>
                  <p style={{ marginTop: '20px', fontSize: '13px', color: '#94a3b8', maxWidth: '300px' }}>
                    Veuillez télécharger et lire attentivement ce document avant de remplir la grille de notation.
                  </p>
                </div>
              </div>

              {/* Panneau Droit : Grille de notation avancée */}
              <div style={{ flex: '0 0 450px', background: '#f8fafc', padding: '30px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>Grille d'Évaluation Finale</h3>
                
                {/* Critères Avancés */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Qualité Rédactionnelle et Structure</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#3D8A4F' }}>{c1} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c1} onChange={(e) => setC1(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#3D8A4F' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Analyse des Données et Résultats</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#3D8A4F' }}>{c2} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c2} onChange={(e) => setC2(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#3D8A4F' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Discussion et Conclusion</label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#3D8A4F' }}>{c3} / 5</span>
                    </div>
                    <input type="range" min="0" max="5" value={c3} onChange={(e) => setC3(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#3D8A4F' }} />
                  </div>
                </div>

                {/* Commentaires détaillés */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Retours détaillés pour l'auteur (Obligatoire)</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Quelles sont les forces et les faiblesses du manuscrit ?"
                    style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'none', fontFamily: 'inherit' }}
                  ></textarea>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Notes confidentielles (Pour le comité orga)</label>
                  <textarea 
                    value={confidential}
                    onChange={(e) => setConfidential(e.target.value)}
                    placeholder="Remarques éventuelles qui ne seront pas vues par l'auteur..."
                    style={{ width: '100%', height: '80px', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', fontSize: '14px', resize: 'none', fontFamily: 'inherit', background: '#fff' }}
                  ></textarea>
                </div>

                {/* Recommandation finale de publication */}
                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Avis sur la Publication (Actes du Congrès)</label>
                  <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}>
                    <option value="">-- Sélectionnez une décision --</option>
                    <option value="publish">✅ Favorable à la publication</option>
                    <option value="publish_minor">⚠️ Favorable sous réserve de corrections</option>
                    <option value="reject">❌ Défavorable à la publication</option>
                  </select>
                </div>

                {/* Bouton de soumission */}
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ width: '100%', background: '#3D8A4F', color: '#fff', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '15px', cursor: submitting ? 'wait' : 'pointer', boxShadow: '0 4px 15px rgba(139,92,246,0.3)', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Envoi en cours…' : 'Envoyer l\'Avis de Publication'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
