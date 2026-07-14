"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { formatFullArticleDate, type FullArticle } from '@/lib/full-articles';
import {
  type LibraryCategory,
  type LibraryDocument,
  type LibraryDocumentInput,
  LIBRARY_CATEGORY_LABELS,
  fetchLibraryDocuments,
  fetchPublishedLibraryArticles,
  uploadLibraryFile,
  createLibraryDocument,
  updateLibraryDocument,
  deleteLibraryDocument,
  getLibraryFileUrl,
} from '@/lib/library';

type FormState = LibraryDocumentInput;

const EMPTY_FORM: FormState = {
  titre: '',
  auteurs: '',
  categorie: 'archive',
  annee: new Date().getFullYear(),
  description: '',
  file_path: '',
  file_name: '',
  file_type: '',
  is_active: true,
  is_featured: false,
  ordre: 0,
};

const FILE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pdf: { label: 'PDF', bg: '#fef2f2', color: '#b91c1c' },
  doc: { label: 'DOC', bg: '#E8F5EC', color: '#145224' },
  docx: { label: 'DOCX', bg: '#E8F5EC', color: '#145224' },
  ppt: { label: 'PPT', bg: '#fff7ed', color: '#c2410c' },
  pptx: { label: 'PPTX', bg: '#fff7ed', color: '#c2410c' },
};

/** Évite les titres TOUT EN MAJUSCULES illisibles. */
function displayTitle(raw: string): string {
  const t = raw.trim();
  if (t.length < 12) return t;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters) return t;
  const upperRatio = letters.replace(/[^A-ZÀ-Ÿ]/g, '').length / letters.length;
  if (upperRatio < 0.7) return t;
  return t
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[.!?…]\s+)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR'))
    .replace(/^(\p{L})/u, (ch) => ch.toLocaleUpperCase('fr-FR'));
}

function fileBadge(doc: LibraryDocument) {
  const ext = (doc.file_type || doc.file_name.split('.').pop() || '').toLowerCase();
  return FILE_BADGE[ext] ?? { label: (ext || 'DOC').toUpperCase(), bg: '#f1f5f9', color: '#475569' };
}

export default function AdminBibliotheque() {
  const { userRole } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<FullArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LibraryCategory | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [libraryDocs, published] = await Promise.all([
      fetchLibraryDocuments(supabase),
      fetchPublishedLibraryArticles(supabase),
    ]);
    setDocs(libraryDocs);
    setPublishedArticles(published);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) void load();
  }, [userRole, load]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (category !== 'all' && doc.categorie !== category) return false;
      if (!q) return true;
      return [doc.titre, doc.auteurs ?? '', doc.description ?? '', String(doc.annee ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [docs, query, category]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<LibraryCategory | 'all', number>> = { all: docs.length };
    for (const doc of docs) counts[doc.categorie] = (counts[doc.categorie] ?? 0) + 1;
    return counts;
  }, [docs]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer la bibliothèque.</p>
      </div>
    );
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setFile(null);
    setMessage(null);
  };

  const openEdit = (doc: LibraryDocument) => {
    setEditingId(doc.id);
    setForm({
      titre: doc.titre,
      auteurs: doc.auteurs ?? '',
      categorie: doc.categorie,
      annee: doc.annee ?? new Date().getFullYear(),
      description: doc.description ?? '',
      file_path: doc.file_path,
      file_name: doc.file_name,
      file_type: doc.file_type ?? '',
      is_active: doc.is_active,
      is_featured: doc.is_featured,
      ordre: doc.ordre ?? 0,
    });
    setFile(null);
    setMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFile(null);
  };

  const handleSave = async () => {
    if (!form.titre.trim()) {
      setMessage({ type: 'error', text: 'Le titre est obligatoire.' });
      return;
    }

    setSaving(true);
    let nextForm = { ...form };

    if (file) {
      const uploaded = await uploadLibraryFile(supabase, form.categorie, form.titre, file, form.file_path);
      if (uploaded.error) {
        setSaving(false);
        setMessage({ type: 'error', text: uploaded.error });
        return;
      }
      nextForm = {
        ...nextForm,
        file_path: uploaded.filePath ?? '',
        file_name: uploaded.fileName,
        file_type: uploaded.fileType ?? '',
      };
    }

    if (editingId === 'new' && !nextForm.file_path) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Ajoutez un fichier pour créer le document.' });
      return;
    }

    const err =
      editingId === 'new'
        ? await createLibraryDocument(supabase, nextForm)
        : await updateLibraryDocument(supabase, editingId!, nextForm);

    setSaving(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }

    setMessage({ type: 'success', text: editingId === 'new' ? 'Document ajouté.' : 'Document mis à jour.' });
    closeForm();
    await load();
  };

  const handleDelete = async (doc: LibraryDocument) => {
    if (!confirm(`Supprimer « ${displayTitle(doc.titre)} » ?`)) return;
    const err = await deleteLibraryDocument(supabase, doc);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Document supprimé.' });
    await load();
  };

  const chips: { id: LibraryCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Tous' },
    ...(['actes', 'article', 'archive', 'guide', 'rapport', 'autre'] as LibraryCategory[])
      .filter((c) => (categoryCounts[c] ?? 0) > 0)
      .map((c) => ({ id: c, label: LIBRARY_CATEGORY_LABELS[c] })),
  ];

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1100px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Gestion
          </p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Bibliothèque</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            Archives et actes mis à disposition des utilisateurs. Les manuscrits « Publié » apparaissent automatiquement en bas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link
            href="/dashboard/bibliotheque"
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Vue publique →
          </Link>
          {!editingId && (
            <button type="button" onClick={openNew} style={buttonPrimary}>
              + Ajouter
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <StatChip label="Documents" value={docs.length} />
        <StatChip label="Actes" value={categoryCounts.actes ?? 0} />
        <StatChip label="Publications JSAN" value={publishedArticles.length} />
        <StatChip label="Masqués" value={docs.filter((d) => !d.is_active).length} muted />
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {editingId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxSizing: 'border-box', width: '100%' }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 14px', fontWeight: 700 }}>
            {editingId === 'new' ? 'Nouveau document' : 'Modifier le document'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre *</label>
              <input style={inputStyle} value={form.titre} onChange={(e) => setField('titre', e.target.value)} placeholder="Titre du document" />
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select style={inputStyle} value={form.categorie} onChange={(e) => setField('categorie', e.target.value as LibraryCategory)}>
                {Object.entries(LIBRARY_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Année</label>
              <input style={inputStyle} type="number" value={form.annee ?? ''} onChange={(e) => setField('annee', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Auteur(s)</label>
              <input style={inputStyle} value={form.auteurs ?? ''} onChange={(e) => setField('auteurs', e.target.value)} placeholder="Nom, institution…" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.description ?? ''} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Fichier {editingId === 'new' ? '*' : ''}</label>
              <input
                style={inputStyle}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                PDF, Word, Excel, PowerPoint, image ou ZIP — max 25 Mo
                {form.file_name ? ` · actuel : ${form.file_name}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setField('is_active', e.target.checked)} />
                Visible
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_featured ?? false} onChange={(e) => setField('is_featured', e.target.checked)} />
                Mis en avant
              </label>
            </div>
            <div>
              <label style={labelStyle}>Ordre</label>
              <input style={inputStyle} type="number" value={form.ordre ?? 0} onChange={(e) => setField('ordre', e.target.value ? Number(e.target.value) : 0)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button type="button" onClick={closeForm} disabled={saving} style={buttonSecondary}>Annuler</button>
            <button type="button" onClick={handleSave} disabled={saving} style={buttonPrimary}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
            Documents ({filteredDocs.length}{filteredDocs.length !== docs.length ? ` / ${docs.length}` : ''})
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '8px 12px',
              minWidth: '200px',
              flex: '1 1 200px',
              maxWidth: '320px',
            }}
          >
            <span style={{ marginRight: '8px', color: '#94a3b8', fontSize: '13px' }}>🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', background: 'transparent' }}
            />
          </div>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
          {chips.map((chip) => {
            const active = category === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCategory(chip.id)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: active ? '1px solid #1B6B2E' : '1px solid #e2e8f0',
                  background: active ? '#1B6B2E' : '#fff',
                  color: active ? '#fff' : '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {chip.label} ({categoryCounts[chip.id] ?? 0})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p style={{ padding: '24px 16px', color: '#94a3b8', margin: 0 }}>Chargement…</p>
        ) : filteredDocs.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Aucun document</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px' }}>Ajoutez un fichier ou modifiez les filtres.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredDocs.map((doc) => {
              const badge = fileBadge(doc);
              return (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '14px 16px',
                    borderTop: '1px solid #f1f5f9',
                    boxSizing: 'border-box',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: badge.bg,
                      color: badge.color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {badge.label}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={tagStyle}>{LIBRARY_CATEGORY_LABELS[doc.categorie]}</span>
                      {doc.annee && <span style={tagStyle}>{doc.annee}</span>}
                      {doc.is_featured && <span style={{ ...tagStyle, background: '#ecfdf5', color: '#047857' }}>Mis en avant</span>}
                      {!doc.is_active && <span style={{ ...tagStyle, background: '#fef2f2', color: '#b91c1c' }}>Masqué</span>}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: '#0f172a',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {displayTitle(doc.titre)}
                    </div>
                    {doc.auteurs && (
                      <div style={{ fontSize: '13px', color: '#475569', marginTop: '3px' }}>{doc.auteurs}</div>
                    )}
                    {doc.description && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '4px',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {doc.description}
                      </div>
                    )}
                    <a
                      href={getLibraryFileUrl(supabase, doc.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#1B6B2E', textDecoration: 'none' }}
                    >
                      Ouvrir le fichier →
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => openEdit(doc)} style={buttonSecondary}>Modifier</button>
                    <button type="button" onClick={() => handleDelete(doc)} style={{ ...buttonSecondary, color: '#b91c1c', borderColor: '#fecaca', background: '#fff' }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 16px', boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 4px', fontWeight: 700 }}>Publications JSAN ({publishedArticles.length})</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px', lineHeight: 1.45 }}>
          Manuscrits du workflow scientifique marqués « Publié ».
        </p>
        {loading ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Chargement…</p>
        ) : publishedArticles.length === 0 ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Aucun manuscrit publié pour l’instant.</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={th}>Titre</th>
                  <th style={th}>Thématique</th>
                  <th style={th}>Date</th>
                  <th style={th}>Fichiers</th>
                </tr>
              </thead>
              <tbody>
                {publishedArticles.map((article) => (
                  <tr key={article.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, maxWidth: '280px', wordBreak: 'break-word' }}>{article.titre}</td>
                    <td style={td}>{article.abstracts?.thematique ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatFullArticleDate(article.updated_at)}</td>
                    <td style={td}>{article.full_article_files?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatChip({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      style={{
        background: muted ? '#f8fafc' : '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 14px',
        minWidth: '110px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

const tagStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  background: '#f1f5f9',
  color: '#475569',
  padding: '2px 8px',
  borderRadius: '999px',
};

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', maxWidth: '100%' };
const buttonPrimary: React.CSSProperties = { background: '#1B6B2E', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' };
const buttonSecondary: React.CSSProperties = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', padding: '7px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' };
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#64748b', fontWeight: 600 };
const td: React.CSSProperties = { padding: '12px', fontSize: '13px', color: '#334155' };
