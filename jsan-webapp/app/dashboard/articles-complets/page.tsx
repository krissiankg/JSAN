"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type FullArticle,
  FULL_ARTICLE_SELECT,
  formatArticleRef,
  formatFullArticleDate,
  fullArticleStatusLabel,
  fullArticleStatusStyle,
  normalizeFullArticle,
  tabMatchesStatus,
} from '@/lib/full-articles';
import { getArticleFileSignedUrl } from '@/lib/article-files';
import {
  type Review,
  aggregateReviewScores,
  formatScoreDisplay,
} from '@/lib/abstracts';
import { recommendationLabel } from '@/lib/submissions-admin';

const TABS = ['Tous', 'En Évaluation', 'Acceptés', 'Publiés'];

function decisionBanner(statut: FullArticle['statut']) {
  if (statut === 'Accepte') {
    return { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', text: 'Votre manuscrit a été accepté pour publication par le comité scientifique.' };
  }
  if (statut === 'Rejete') {
    return { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', text: 'Votre manuscrit n\'a pas été retenu pour publication. Consultez les retours des évaluateurs ci-dessous.' };
  }
  if (statut === 'Soumis') {
    return { bg: '#fffbeb', border: '#fde68a', color: '#b45309', text: 'Des corrections vous ont été demandées. Vous pouvez soumettre une nouvelle version depuis « Nouvel article ».' };
  }
  if (statut === 'Publie') {
    return { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', text: 'Votre article est publié.' };
  }
  return null;
}

export default function ArticlesComplets() {
  const { user } = useAuth();
  const supabase = createClient();
  const [articles, setArticles] = useState<FullArticle[]>([]);
  const [reviewsByAbstract, setReviewsByAbstract] = useState<Map<string, Review[]>>(new Map());
  const [activeTab, setActiveTab] = useState('Tous');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('full_articles')
        .select(FULL_ARTICLE_SELECT)
        .eq('author_id', user.id)
        .neq('statut', 'Brouillon')
        .order('updated_at', { ascending: false });

      const rows = (data ?? []).map((row) => normalizeFullArticle(row));
      setArticles(rows);

      const abstractIds = rows.map((a) => a.abstract_id).filter(Boolean);
      if (abstractIds.length) {
        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('id, abstract_id, reviewer_id, scores, commentaires_auteurs, statut, created_at, updated_at')
          .in('abstract_id', abstractIds)
          .eq('statut', 'Complete');

        const map = new Map<string, Review[]>();
        for (const rev of (reviewRows ?? []) as Review[]) {
          const list = map.get(rev.abstract_id) ?? [];
          list.push(rev);
          map.set(rev.abstract_id, list);
        }
        setReviewsByAbstract(map);
      }

      setLoading(false);
    }
    load();
  }, [user, supabase]);

  const filtered = useMemo(
    () => articles.filter((a) => tabMatchesStatus(activeTab, a.statut)),
    [articles, activeTab]
  );

  const handleDownload = async (storagePath: string) => {
    const url = await getArticleFileSignedUrl(supabase, storagePath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
        Historique de vos manuscrits soumis, retours des évaluateurs et décision du comité.
      </p>

      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
                background: activeTab === tab ? '#111827' : 'transparent',
                color: activeTab === tab ? '#ffffff' : '#64748b',
                fontWeight: activeTab === tab ? 600 : 500,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Chargement…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map((item) => {
              const style = fullArticleStatusStyle(item.statut);
              const mainFile = item.full_article_files?.find((f) => f.type_document === 'Manuscrit_Principal');
              const reviews = reviewsByAbstract.get(item.abstract_id) ?? [];
              const scores = aggregateReviewScores(reviews);
              const banner = decisionBanner(item.statut);
              const isExpanded = expandedId === item.id;
              const hasFeedback = reviews.length > 0 || banner;

              return (
                <div key={item.id} style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '12px', alignItems: 'center', padding: '14px 16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px', marginBottom: '4px' }}>{item.titre}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Réf. {formatArticleRef(item.id)}</div>
                    </div>
                    <span style={{ ...style, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fullArticleStatusLabel(item.statut)}
                    </span>
                    {reviews.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatScoreDisplay(scores.pertinence)}</span>
                        <span style={{ display: 'block', fontSize: '10px' }}>Pertinence</span>
                      </div>
                    )}
                    {mainFile ? (
                      <button type="button" onClick={() => handleDownload(mainFile.file_url)} style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', color: '#64748b', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        📄 Fichier
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                    )}
                    <div style={{ textAlign: 'right', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatFullArticleDate(item.updated_at)}
                    </div>
                  </div>

                  {hasFeedback && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '0 16px' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{
                          width: '100%', padding: '10px 0', background: 'none', border: 'none',
                          color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {isExpanded ? '▾ Masquer les retours' : '▸ Voir les retours et la décision'}
                      </button>

                      {isExpanded && (
                        <div style={{ paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {banner && (
                            <div style={{
                              padding: '12px 14px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5,
                              background: banner.bg, border: `1px solid ${banner.border}`, color: banner.color,
                            }}>
                              {banner.text}
                            </div>
                          )}

                          {reviews.length > 0 ? (
                            <div>
                              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Pertinence moyenne</div>
                                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatScoreDisplay(scores.pertinence)}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Qualité moyenne</div>
                                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatScoreDisplay(scores.qualite)}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {reviews.map((rev) => {
                                  const s = rev.scores ?? {};
                                  return (
                                    <div key={rev.id} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#475569', marginBottom: rev.commentaires_auteurs ? '8px' : 0 }}>
                                        {typeof s.pertinence === 'number' && <span>Pertinence : <strong>{s.pertinence}/5</strong></span>}
                                        {typeof s.qualite === 'number' && <span>Qualité : <strong>{s.qualite}/5</strong></span>}
                                        {typeof s.originalite === 'number' && <span>Originalité : <strong>{s.originalite}/5</strong></span>}
                                        {typeof s.methodologie === 'number' && <span>Méthodologie : <strong>{s.methodologie}/5</strong></span>}
                                        {typeof s.recommandation === 'string' && s.recommandation && (
                                          <span>Recommandation : <strong>{recommendationLabel(s.recommandation)}</strong></span>
                                        )}
                                      </div>
                                      {rev.commentaires_auteurs && (
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }}>
                                          « {rev.commentaires_auteurs} »
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                              {item.statut === 'En_Evaluation' || item.statut === 'Soumis'
                                ? 'Évaluation en cours — les retours apparaîtront ici une fois complétés.'
                                : 'Aucun retour d\'évaluateur disponible.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>
                Aucun article pour ce filtre.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
