"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchLibraryDocuments,
  getLibraryFileUrl,
  groupLibraryByCategory,
  LIBRARY_CATEGORY_LABELS,
  type LibraryCategory,
  type LibraryDocument,
} from '@/lib/library';

const FILE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pdf: { label: 'PDF', bg: '#fef2f2', color: '#b91c1c' },
  doc: { label: 'DOC', bg: '#E8F5EC', color: '#145224' },
  docx: { label: 'DOCX', bg: '#E8F5EC', color: '#145224' },
  ppt: { label: 'PPT', bg: '#fff7ed', color: '#c2410c' },
  pptx: { label: 'PPTX', bg: '#fff7ed', color: '#c2410c' },
};

function fileBadge(doc: LibraryDocument) {
  const ext = (doc.file_type || doc.file_name.split('.').pop() || '').toLowerCase();
  return FILE_BADGE[ext] ?? { label: ext.toUpperCase() || 'FICHIER', bg: '#f1f5f9', color: '#475569' };
}

export default function BibliothequePage() {
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LibraryCategory | 'all'>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setDocs(await fetchLibraryDocuments(supabase, { activeOnly: true }));
      setLoading(false);
    }
    void load();
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (category !== 'all' && doc.categorie !== category) return false;
      if (!q) return true;
      return [doc.titre, doc.auteurs ?? '', doc.description ?? '', doc.annee?.toString() ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [docs, query, category]);

  const groups = groupLibraryByCategory(filtered);
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<LibraryCategory | 'all', number>> = { all: docs.length };
    for (const doc of docs) {
      counts[doc.categorie] = (counts[doc.categorie] ?? 0) + 1;
    }
    return counts;
  }, [docs]);

  const filterChips: { id: LibraryCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Tous' },
    ...(['actes', 'article', 'archive', 'guide', 'rapport', 'autre'] as LibraryCategory[])
      .filter((c) => (categoryCounts[c] ?? 0) > 0)
      .map((c) => ({ id: c, label: LIBRARY_CATEGORY_LABELS[c] })),
  ];

  return (
    <div className="page-shell" style={{ maxWidth: '1040px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0F2E18 0%, #145224 48%, #1B6B2E 100%)',
          borderRadius: '18px',
          padding: '28px 28px 24px',
          color: '#fff',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 28px rgba(15, 46, 24, 0.22)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1B6B2E 0 34%, #F0C419 34% 66%, #D94A2A 66% 100%)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: '-40px',
            top: '-40px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(240,196,25,0.22) 0%, transparent 70%)',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: '8px' }}>
            Ressources JSAN
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 8px' }}>Bibliothèque Scientifique</h1>
          <p style={{ margin: '0 0 18px', fontSize: '14px', lineHeight: 1.55, opacity: 0.85, maxWidth: '560px' }}>
            Actes, guides et documents partagés par l’équipe — dont les résumés de la 11ᵉ édition JSAN 2025.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: 600 }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </div>
            {(categoryCounts.actes ?? 0) > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: 600 }}>
                {categoryCounts.actes} acte{(categoryCounts.actes ?? 0) !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: '1 1 260px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 14px',
            minWidth: 0,
          }}
        >
          <span style={{ marginRight: '8px', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titre, auteur, année…"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              background: 'transparent',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
        {filterChips.map((chip) => {
          const active = category === chip.id;
          const count = categoryCounts[chip.id] ?? 0;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setCategory(chip.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '999px',
                border: active ? '1px solid #1B6B2E' : '1px solid #e2e8f0',
                background: active ? '#1B6B2E' : '#fff',
                color: active ? '#fff' : '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {chip.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement de la bibliothèque…</p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: '#f8fafc',
            borderRadius: '16px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📚</div>
          <p style={{ color: '#334155', fontWeight: 600, margin: '0 0 6px' }}>Aucun document trouvé</p>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>Essayez un autre mot-clé ou une autre catégorie.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {groups.map((group) => (
            <section key={group.category}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {group.label}
                </h2>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                  {group.items.length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {group.items.map((doc) => {
                  const badge = fileBadge(doc);
                  return (
                    <article
                      key={doc.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'flex-start',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: badge.bg,
                          color: badge.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.02em',
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                          {doc.is_featured && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                background: '#ecfdf5',
                                color: '#047857',
                                padding: '3px 8px',
                                borderRadius: '999px',
                              }}
                            >
                              Mis en avant
                            </span>
                          )}
                          {doc.annee && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '3px 8px',
                                borderRadius: '999px',
                              }}
                            >
                              {doc.annee}
                            </span>
                          )}
                        </div>

                        <h3
                          style={{
                            margin: '0 0 6px',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                          }}
                        >
                          {doc.titre}
                        </h3>

                        {doc.auteurs && (
                          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                            {doc.auteurs}
                          </div>
                        )}

                        {doc.description && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              lineHeight: 1.5,
                              marginTop: '4px',
                            }}
                          >
                            {doc.description}
                          </div>
                        )}
                      </div>

                      <a
                        href={getLibraryFileUrl(supabase, doc.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flexShrink: 0,
                          alignSelf: 'center',
                          background: '#1B6B2E',
                          color: '#fff',
                          padding: '9px 14px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ouvrir →
                      </a>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
