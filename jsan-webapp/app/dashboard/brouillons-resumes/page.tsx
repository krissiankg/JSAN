"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { type Abstract, ABSTRACT_SELECT, formatAbstractDate } from '@/lib/abstracts';
import { deleteAllAbstractFiles } from '@/lib/abstract-files';

export default function BrouillonsResumes() {
  const { user } = useAuth();
  const supabase = createClient();
  const [drafts, setDrafts] = useState<Abstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDrafts = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('abstracts')
      .select(ABSTRACT_SELECT)
      .eq('author_id', user.id)
      .eq('statut', 'Brouillon')
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setDrafts([]);
    } else {
      setDrafts((data ?? []) as Abstract[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDrafts();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (draft: Abstract) => {
    if (!confirm('Supprimer ce brouillon ? Cette action est irréversible.')) return;
    setDeletingId(draft.id);
    setError(null);

    if (draft.abstract_files?.length) {
      await deleteAllAbstractFiles(supabase, draft.abstract_files);
    }
    const { error: deleteError } = await supabase.from('abstracts').delete().eq('id', draft.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Reprenez la rédaction de vos résumés là où vous l&apos;avez laissée.</p>
        <Link href="/dashboard/nouvelle-soumission" style={{ background: '#111827', color: '#ffffff', padding: '6px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: '13px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          ➕ Nouveau Résumé
        </Link>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Chargement…</p>
      ) : drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
          <p style={{ marginBottom: '16px' }}>Aucun brouillon pour le moment.</p>
          <Link href="/dashboard/nouvelle-soumission" style={{ color: '#1B6B2E', fontWeight: 600 }}>Commencer une nouvelle soumission</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {drafts.map((draft) => {
            const fileCount = draft.abstract_files?.length ?? 0;
            const coAuthorCount = draft.abstract_authors?.length ?? 0;
            return (
            <div key={draft.id} style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>Brouillon</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Modifié {formatAbstractDate(draft.updated_at)}</span>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px', lineHeight: 1.4 }}>
                  {draft.titre || 'Sans titre'}
                </h3>
                {draft.thematique && (
                  <span style={{ display: 'inline-block', fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                    {draft.thematique}
                  </span>
                )}
                <p style={{ fontSize: '12px', color: draft.contenu_texte ? '#64748b' : '#94a3b8', fontStyle: draft.contenu_texte ? 'normal' : 'italic', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {draft.contenu_texte || 'Aucun contenu saisi pour le moment.'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                  {coAuthorCount > 0 && <span>👥 {coAuthorCount} auteur{coAuthorCount > 1 ? 's' : ''}</span>}
                  {fileCount > 0 && <span>📎 {fileCount} fichier{fileCount > 1 ? 's' : ''}</span>}
                  {draft.mots_cles && <span>🏷️ {draft.mots_cles.split(',').length} mot{draft.mots_cles.split(',').length > 1 ? 's' : ''}-clé</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <Link href={`/dashboard/nouvelle-soumission?id=${draft.id}`} style={{ flex: 1, textAlign: 'center', background: '#f8fafc', color: '#1B6B2E', border: '1px solid #B7DFC0', padding: '6px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 500 }}>
                  Continuer
                </Link>
                <button
                  onClick={() => handleDelete(draft)}
                  disabled={deletingId === draft.id}
                  style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {deletingId === draft.id ? '…' : '🗑️'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
