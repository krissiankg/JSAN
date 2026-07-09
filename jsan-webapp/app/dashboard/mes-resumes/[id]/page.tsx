"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type Abstract,
  ABSTRACT_DETAIL_SELECT,
  abstractStatusLabel,
  abstractStatusStyle,
  aggregateReviewScores,
  formatAbstractDate,
  formatAbstractRef,
  formatReviewerComment,
  formatScoreDisplay,
} from '@/lib/abstracts';
import { getAbstractFileSignedUrl } from '@/lib/abstract-files';

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [abstract, setAbstract] = useState<Abstract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user || !id) return;
      const { data, error: fetchError } = await supabase
        .from('abstracts')
        .select(ABSTRACT_DETAIL_SELECT)
        .eq('id', id)
        .eq('author_id', user.id)
        .neq('statut', 'Brouillon')
        .maybeSingle();

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Résumé introuvable.');
        setLoading(false);
        return;
      }

      setAbstract(data as Abstract);
      setLoading(false);
    }
    load();
  }, [user, id, supabase]);

  const handleDownload = async (storagePath: string) => {
    const url = await getAbstractFileSignedUrl(supabase, storagePath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Chargement du résumé…</div>;
  }

  if (error || !abstract) {
    return (
      <div style={{ padding: '40px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '8px', maxWidth: '520px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px' }}>Résumé introuvable</h2>
          <p style={{ margin: 0, fontSize: '14px' }}>{error ?? 'Ce résumé n\'existe pas ou n\'est pas accessible.'}</p>
          <Link href="/dashboard/mes-resumes" style={{ display: 'inline-block', marginTop: '16px', color: '#2563eb', fontSize: '14px' }}>
            ← Retour à mes résumés
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = abstractStatusStyle(abstract.statut);
  const scores = aggregateReviewScores(abstract.reviews);
  const reviewerComment = formatReviewerComment(abstract.reviews);
  const coAuthors = [...(abstract.abstract_authors ?? [])].sort(
    (a, b) => (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      <div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/mes-resumes')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '12px' }}
        >
          ← Retour à mes résumés
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
              {formatAbstractRef(abstract.id)}
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
              {abstract.titre}
            </h1>
          </div>
          <span style={{ ...statusStyle, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
            {abstractStatusLabel(abstract.statut)}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Thématique', value: abstract.thematique ?? '—' },
          { label: 'Type de présentation', value: abstract.type_presentation_global ?? '—' },
          { label: 'Soumis le', value: formatAbstractDate(abstract.created_at) },
          { label: 'Dernière mise à jour', value: formatAbstractDate(abstract.updated_at) },
        ].map((item) => (
          <div key={item.label} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
            <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {abstract.mots_cles && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Mots-clés</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{abstract.mots_cles}</p>
        </div>
      )}

      {abstract.contenu_texte && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Contenu du résumé</h2>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {abstract.contenu_texte}
          </div>
        </div>
      )}

      {coAuthors.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Co-auteurs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {coAuthors.map((author, idx) => (
              <div key={author.id ?? idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                  {author.prenom} {author.nom}
                  {author.est_orateur && (
                    <span style={{ marginLeft: '6px', fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px' }}>
                      Orateur
                    </span>
                  )}
                </span>
                {author.affiliation && <span style={{ color: '#64748b' }}>· {author.affiliation}</span>}
                {author.email && <span style={{ color: '#94a3b8' }}>· {author.email}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(abstract.abstract_files?.length ?? 0) > 0 && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Fichiers joints</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {abstract.abstract_files!.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handleDownload(file.file_url)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                  padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: '#2563eb', textAlign: 'left',
                }}
              >
                📄 {file.file_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(abstract.reviews?.length ?? 0) > 0 && (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Évaluation</h2>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Pertinence</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{formatScoreDisplay(scores.pertinence)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Qualité</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{formatScoreDisplay(scores.qualite)}</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
            &ldquo;{reviewerComment}&rdquo;
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <Link
          href="/dashboard/statut-evaluations"
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
        >
          Voir le statut des évaluations
        </Link>
        {abstract.statut === 'Accepte' && (
          <Link
            href={`/dashboard/nouvel-article?abstractId=${abstract.id}`}
            style={{ padding: '8px 16px', borderRadius: '8px', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
          >
            Soumettre l&apos;article complet →
          </Link>
        )}
        {abstract.statut === 'A_Reviser' && (
          <Link
            href={`/dashboard/nouvelle-soumission?id=${abstract.id}`}
            style={{ padding: '8px 16px', borderRadius: '8px', background: '#b45309', color: '#fff', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
          >
            Réviser ce résumé →
          </Link>
        )}
      </div>
    </div>
  );
}
