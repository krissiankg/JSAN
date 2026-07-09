"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type Abstract,
  type AbstractStatus,
  ABSTRACT_WITH_REVIEWS_SELECT,
  abstractStatusLabel,
  aggregateReviewScores,
  formatAbstractRef,
  formatReviewerComment,
  formatScoreDisplay,
} from '@/lib/abstracts';

const DECIDED_STATUSES: AbstractStatus[] = ['Accepte', 'Rejete', 'A_Reviser'];

function EvaluationTable({
  items,
  borderColor,
  emptyMessage,
  renderAction,
}: {
  items: Abstract[];
  borderColor: string;
  emptyMessage: string;
  renderAction: (item: Abstract) => React.ReactNode;
}) {
  if (!items.length) {
    return (
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: `1px solid ${borderColor}`, textAlign: 'center', color: '#94a3b8' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: `1px solid ${borderColor}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ color: '#94a3b8', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
            <th style={{ paddingBottom: '8px', fontWeight: 500, width: '10%' }}>Identité</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, width: '15%' }}>Titre</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, width: '10%' }}>Thématique</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, width: '20%' }}>Commentaire de l&apos;évaluateur</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, textAlign: 'center', width: '10%' }}>Pertinence</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, textAlign: 'center', width: '10%' }}>Qualité</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, textAlign: 'center', width: '10%' }}>Statut</th>
            <th style={{ paddingBottom: '8px', fontWeight: 500, textAlign: 'right', width: '15%' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const scores = aggregateReviewScores(item.reviews);
            const comment = formatReviewerComment(item.reviews);
            const statusLabel = abstractStatusLabel(item.statut);
            const statusColors =
              item.statut === 'Accepte'
                ? { background: '#dcfce7', color: '#166534' }
                : item.statut === 'A_Reviser'
                  ? { background: '#fef3c7', color: '#b45309' }
                  : { background: '#fef2f2', color: '#dc2626' };

            return (
              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 0', color: '#475569', fontWeight: 600, fontSize: '13px', verticalAlign: 'top' }}>
                  {formatAbstractRef(item.id)}
                </td>
                <td style={{ padding: '12px 0', paddingRight: '15px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.4, fontSize: '13px' }}>{item.titre}</div>
                </td>
                <td style={{ padding: '12px 0', paddingRight: '15px', verticalAlign: 'top' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                    {item.thematique ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '12px 0', paddingRight: '20px', verticalAlign: 'top' }}>
                  <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                    &ldquo;{comment}&rdquo;
                  </p>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'center', verticalAlign: 'top' }}>
                  <strong style={{ color: scores.pertinence !== null && scores.pertinence >= 4 ? '#10b981' : '#1e293b', fontSize: '13px' }}>
                    {formatScoreDisplay(scores.pertinence)}
                  </strong>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'center', verticalAlign: 'top' }}>
                  <strong style={{ color: scores.qualite !== null && scores.qualite >= 4 ? '#10b981' : '#1e293b', fontSize: '13px' }}>
                    {formatScoreDisplay(scores.qualite)}
                  </strong>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'center', verticalAlign: 'top' }}>
                  <span style={{ ...statusColors, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
                    {statusLabel}
                  </span>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right', verticalAlign: 'top' }}>
                  {renderAction(item)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StatutEvaluations() {
  const { user } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<Abstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const { data: rows, error: fetchError } = await supabase
        .from('abstracts')
        .select(ABSTRACT_WITH_REVIEWS_SELECT)
        .eq('author_id', user.id)
        .in('statut', DECIDED_STATUSES)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setData((rows ?? []) as Abstract[]);
      setLoading(false);
    }

    load();
  }, [user, supabase]);

  const { refused, accepted } = useMemo(() => {
    const refused = data.filter((a) => a.statut === 'Rejete' || a.statut === 'A_Reviser');
    const accepted = data.filter((a) => a.statut === 'Accepte');
    return { refused, accepted };
  }, [data]);

  if (loading) {
    return <p style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Chargement des évaluations…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
        Consultez les résultats de l&apos;évaluation de vos résumés par le comité scientifique.
      </p>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
          Impossible de charger les évaluations : {error}
        </div>
      )}

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>❌</span> Résumés refusés ou à réviser
        </h2>
        <EvaluationTable
          items={refused}
          borderColor="#fee2e2"
          emptyMessage="Aucun résumé refusé ou à réviser pour le moment."
          renderAction={(item) => (
            <Link
              href={`/dashboard/nouvelle-soumission?id=${item.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#111827', color: '#ffffff', padding: '6px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: '13px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            >
              <span>✍️</span> Corriger
            </Link>
          )}
        />
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#166534', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✅</span> Résumés acceptés
        </h2>
        <EvaluationTable
          items={accepted}
          borderColor="#dcfce7"
          emptyMessage="Aucun résumé accepté pour le moment."
          renderAction={(item) => (
            <Link
              href={`/dashboard/nouvel-article?abstractId=${item.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#10b981', color: '#ffffff', padding: '6px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: '13px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            >
              <span>📝</span> Soumettre article
            </Link>
          )}
        />
      </div>
    </div>
  );
}
