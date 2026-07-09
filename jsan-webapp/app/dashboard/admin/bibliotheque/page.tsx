"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    if (isEventStaff(userRole)) {
      void load();
    }
  }, [userRole, load]);

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

    const err =
      editingId === 'new'
        ? await createLibraryDocument(supabase, nextForm)
        : await updateLibraryDocument(supabase, editingId!, nextForm);

    setSaving(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }

    setMessage({ type: 'success', text: editingId === 'new' ? 'Document ajouté à la bibliothèque.' : 'Document mis à jour.' });
    closeForm();
    await load();
  };

  const handleDelete = async (doc: LibraryDocument) => {
    if (!confirm(`Supprimer le document « ${doc.titre} » ?`)) return;
    const err = await deleteLibraryDocument(supabase, doc);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Document supprimé.' });
    await load();
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Bibliothèque Scientifique</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '720px' }}>
            Uploadez d'anciens documents, actes ou rapports dans la bibliothèque, et suivez en parallèle les manuscrits JSAN déjà publiés.
          </p>
        </div>
        {!editingId && (
          <button type="button" onClick={openNew} style={buttonPrimary}>
            + Ajouter un document
          </button>
        )}
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
        La bibliothèque sert à conserver des <strong>anciens documents</strong> (actes, rapports, guides, archives),
        tandis que les <strong>publications JSAN</strong> sont remontées automatiquement depuis les manuscrits marqués « Publié ».
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {message.text}
        </div>
      )}

      {editingId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 16px' }}>{editingId === 'new' ? 'Nouveau document' : 'Modifier le document'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre *</label>
              <input style={inputStyle} value={form.titre} onChange={(e) => setField('titre', e.target.value)} placeholder="Actes JSAN 2018, Rapport annuel, Guide..." />
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
              <input style={inputStyle} value={form.auteurs ?? ''} onChange={(e) => setField('auteurs', e.target.value)} placeholder="Nom institution, comité, auteurs..." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '70px' }} value={form.description ?? ''} onChange={(e) => setField('description', e.target.value)} placeholder="Contexte, contenu, utilité du document..." />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Fichier</label>
              <input
                style={inputStyle}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                PDF, Word, Excel, PowerPoint, image ou ZIP. Max 25 Mo.
                {form.file_name ? ` Fichier actuel : ${form.file_name}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setField('is_active', e.target.checked)} />
                Visible aux utilisateurs
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_featured ?? false} onChange={(e) => setField('is_featured', e.target.checked)} />
                Mettre en avant
              </label>
            </div>
            <div>
              <label style={labelStyle}>Ordre</label>
              <input style={inputStyle} type="number" value={form.ordre ?? 0} onChange={(e) => setField('ordre', e.target.value ? Number(e.target.value) : 0)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={closeForm} disabled={saving} style={buttonSecondary}>Annuler</button>
            <button type="button" onClick={handleSave} disabled={saving} style={buttonPrimary}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 16px' }}>Documents de bibliothèque ({docs.length})</h2>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : docs.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Aucun document archivé pour l'instant.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {docs.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#f8fafc', borderRadius: '12px', padding: '14px 16px' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong>{doc.titre}</strong>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#e2e8f0', padding: '3px 8px', borderRadius: '8px' }}>{LIBRARY_CATEGORY_LABELS[doc.categorie]}</span>
                    {doc.annee && <span style={{ fontSize: '12px', color: '#64748b' }}>{doc.annee}</span>}
                    {!doc.is_active && <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>Masqué</span>}
                  </div>
                  {doc.auteurs && <div style={{ fontSize: '13px', color: '#475569' }}>{doc.auteurs}</div>}
                  {doc.description && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{doc.description}</div>}
                  <a href={getLibraryFileUrl(supabase, doc.file_path)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>
                    Ouvrir le document
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignSelf: 'start' }}>
                  <button type="button" onClick={() => openEdit(doc)} style={buttonSecondary}>Modifier</button>
                  <button type="button" onClick={() => handleDelete(doc)} style={{ ...buttonSecondary, color: '#b91c1c', borderColor: '#fca5a5' }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Publications JSAN déjà marquées « Publié » ({publishedArticles.length})</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
          Ces manuscrits viennent du workflow scientifique. Pour publier un ancien document hors JSAN, utilisez la section ci-dessus.
        </p>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : publishedArticles.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Aucun manuscrit publié pour l'instant.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={th}>Titre</th>
                  <th style={th}>Thématique</th>
                  <th style={th}>Date</th>
                  <th style={th}>Fichiers</th>
                </tr>
              </thead>
              <tbody>
                {publishedArticles.map((article) => (
                  <tr key={article.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>{article.titre}</td>
                    <td style={td}>{article.abstracts?.thematique ?? '—'}</td>
                    <td style={td}>{formatFullArticleDate(article.updated_at)}</td>
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

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' };
const buttonPrimary: React.CSSProperties = { background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' };
const buttonSecondary: React.CSSProperties = { background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#64748b' };
const td: React.CSSProperties = { padding: '12px', fontSize: '13px', color: '#334155' };
