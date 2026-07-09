"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchLibraryDocuments,
  getLibraryFileUrl,
  groupLibraryByCategory,
  type LibraryDocument,
} from '@/lib/library';

export default function BibliothequePage() {
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setDocs(await fetchLibraryDocuments(supabase, { activeOnly: true }));
      setLoading(false);
    }
    void load();
  }, [supabase]);

  const filtered = docs.filter((doc) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [doc.titre, doc.auteurs ?? '', doc.description ?? '', doc.annee?.toString() ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const groups = groupLibraryByCategory(filtered);

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '20px', paddingBottom: '50px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Bibliothèque Scientifique</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Consultez les anciens documents, actes, guides et rapports mis à disposition par l'équipe JSAN.
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un titre, un auteur, une année..."
          style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement de la bibliothèque…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📚</div>
          <p style={{ color: '#64748b', margin: 0 }}>Aucun document trouvé.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {groups.map((group) => (
            <section key={group.category}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>{group.label}</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {group.items.map((doc) => (
                  <div key={doc.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{doc.titre}</div>
                        {(doc.auteurs || doc.annee) && (
                          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                            {[doc.auteurs, doc.annee].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {doc.description && <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.55 }}>{doc.description}</div>}
                      </div>
                      <a
                        href={getLibraryFileUrl(supabase, doc.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ alignSelf: 'start', background: '#0f172a', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        Ouvrir
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
