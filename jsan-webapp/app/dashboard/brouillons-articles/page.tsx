"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { type FullArticle, FULL_ARTICLE_SELECT, formatFullArticleDate, normalizeFullArticle } from '@/lib/full-articles';
import { deleteAllArticleFiles, hasMainManuscript } from '@/lib/article-files';

export default function BrouillonsArticles() {
  const { user } = useAuth();
  const supabase = createClient();
  const [drafts, setDrafts] = useState<FullArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('full_articles')
        .select(FULL_ARTICLE_SELECT)
        .eq('author_id', user.id)
        .eq('statut', 'Brouillon')
        .order('updated_at', { ascending: false });
      setDrafts((data ?? []).map((row) => normalizeFullArticle(row)));
      setLoading(false);
    }
    load();
  }, [user, supabase]);

  const handleDelete = async (draft: FullArticle) => {
    if (!confirm('Supprimer ce brouillon d\'article ?')) return;
    setDeletingId(draft.id);
    if (draft.full_article_files?.length) {
      await deleteAllArticleFiles(supabase, draft.full_article_files);
    }
    await supabase.from('full_articles').delete().eq('id', draft.id);
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setDeletingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Finalisez vos manuscrits avant la soumission définitive.</p>
        <Link href="/dashboard/nouvel-article" style={{ background: '#111827', color: '#ffffff', padding: '6px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: '13px' }}>
          ➕ Nouvel article
        </Link>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Chargement…</p>
      ) : drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
          <p style={{ marginBottom: '16px' }}>Aucun brouillon d&apos;article.</p>
          <Link href="/dashboard/nouvel-article" style={{ color: '#2563eb', fontWeight: 600 }}>Créer un article</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {drafts.map((draft) => {
            const hasMain = hasMainManuscript(draft.full_article_files);
            return (
              <div key={draft.id} style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>Brouillon</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Modifié {formatFullArticleDate(draft.updated_at)}</span>
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px', lineHeight: 1.4 }}>{draft.titre}</h3>
                  {draft.abstracts?.titre && (
                    <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Résumé : {draft.abstracts.titre}</p>
                  )}
                  <p style={{ fontSize: '12px', color: hasMain ? '#166534' : '#b45309', margin: 0 }}>
                    {hasMain ? '✓ Manuscrit principal joint' : '⚠ Manuscrit principal manquant'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Link href={`/dashboard/nouvel-article?id=${draft.id}`} style={{ flex: 1, textAlign: 'center', background: '#f8fafc', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 500 }}>
                    Continuer
                  </Link>
                  <button type="button" disabled={deletingId === draft.id} onClick={() => handleDelete(draft)} style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
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
