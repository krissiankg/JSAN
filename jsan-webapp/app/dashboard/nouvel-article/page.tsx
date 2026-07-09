"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type FullArticle,
  type FullArticleFile,
  FULL_ARTICLE_SELECT,
  normalizeFullArticle,
} from '@/lib/full-articles';
import {
  deleteArticleFileRecord,
  getArticleFileSignedUrl,
  hasMainManuscript,
  uploadArticleFile,
} from '@/lib/article-files';
import {
  DEFAULT_ARTICLE_INSTRUCTIONS,
  instructionFormatLabel,
  isInstructionDocumentPublished,
  parseDocumentsConfig,
  type InstructionDocument,
} from '@/lib/author-instructions';
import { getEventDocumentSignedUrl } from '@/lib/event-documents';

interface AcceptedAbstract {
  id: string;
  titre: string;
  mots_cles: string | null;
}

export default function SubmitArticlePage() {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const preselectAbstractId = searchParams.get('abstractId');

  const [acceptedAbstracts, setAcceptedAbstracts] = useState<AcceptedAbstract[]>([]);
  const [abstractId, setAbstractId] = useState(preselectAbstractId ?? '');
  const [articleId, setArticleId] = useState<string | null>(editId);
  const [title, setTitle] = useState('');
  const [motsCles, setMotsCles] = useState('');
  const [declarationConflit, setDeclarationConflit] = useState(false);
  const [declarationPlagiat, setDeclarationPlagiat] = useState(false);
  const [files, setFiles] = useState<FullArticleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [instructionsDoc, setInstructionsDoc] = useState<InstructionDocument>(DEFAULT_ARTICLE_INSTRUCTIONS);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);

  const loadAcceptedAbstracts = useCallback(async () => {
    if (!user) return;
    const { data: abstracts } = await supabase
      .from('abstracts')
      .select('id, titre, mots_cles')
      .eq('author_id', user.id)
      .eq('statut', 'Accepte')
      .order('updated_at', { ascending: false });

    const { data: existing } = await supabase
      .from('full_articles')
      .select('abstract_id, statut')
      .eq('author_id', user.id);

    const blocked = new Set(
      (existing ?? [])
        .filter((a) => a.statut !== 'Brouillon')
        .map((a) => a.abstract_id)
    );

    const available = (abstracts ?? []).filter((a) => !blocked.has(a.id) || a.id === preselectAbstractId || a.id === editId);
    setAcceptedAbstracts(available as AcceptedAbstract[]);
  }, [user, supabase, preselectAbstractId, editId]);

  const loadArticle = useCallback(async () => {
    if (!editId || !user) return;
    const { data, error } = await supabase
      .from('full_articles')
      .select(FULL_ARTICLE_SELECT)
      .eq('id', editId)
      .eq('author_id', user.id)
      .single();

    if (error || !data) {
      setMessage({ type: 'error', text: 'Article introuvable.' });
      setLoading(false);
      return;
    }

    const article: FullArticle = normalizeFullArticle(data);
    setArticleId(article.id);
    setAbstractId(article.abstract_id);
    setTitle(article.titre);
    setMotsCles(article.mots_cles ?? '');
    setDeclarationConflit(article.declaration_conflit);
    setDeclarationPlagiat(article.declaration_plagiat);
    setFiles(article.full_article_files ?? []);
    setLoading(false);
  }, [editId, user, supabase]);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('events_config').select('documents_config').limit(1).maybeSingle();
      if (data?.documents_config) {
        setInstructionsDoc(parseDocumentsConfig(data.documents_config).instructions_article);
      }
    }
    loadConfig();
  }, [supabase]);

  useEffect(() => {
    loadAcceptedAbstracts().then(() => {
      if (editId) loadArticle();
      else setLoading(false);
    });
  }, [loadAcceptedAbstracts, loadArticle, editId]);

  const handleAbstractChange = (id: string) => {
    setAbstractId(id);
    const abs = acceptedAbstracts.find((a) => a.id === id);
    if (abs && !editId) {
      setTitle(abs.titre);
      setMotsCles(abs.mots_cles ?? '');
    }
  };

  const ensureArticleSaved = async (): Promise<string | null> => {
    if (!user || !abstractId) {
      setMessage({ type: 'error', text: 'Sélectionnez un résumé accepté.' });
      return null;
    }
    if (articleId) return articleId;

    const payload = {
      abstract_id: abstractId,
      author_id: user.id,
      titre: title.trim() || 'Sans titre',
      mots_cles: motsCles.trim() || null,
      declaration_conflit: declarationConflit,
      declaration_plagiat: declarationPlagiat,
      statut: 'Brouillon' as const,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('full_articles').insert(payload).select('id').single();
    if (error || !data) {
      setMessage({ type: 'error', text: error?.message ?? 'Impossible de créer le brouillon.' });
      return null;
    }
    setArticleId(data.id);
    return data.id;
  };

  const handleFileUpload = async (file: File, isAnnex: boolean) => {
    if (!user) return;
    setUploading(true);
    const targetId = await ensureArticleSaved();
    if (!targetId) {
      setUploading(false);
      return;
    }

    const { data, error } = await uploadArticleFile(
      supabase,
      user.id,
      targetId,
      file,
      isAnnex ? 'Annexes' : 'Manuscrit_Principal'
    );
    setUploading(false);

    if (error || !data) {
      setMessage({ type: 'error', text: error ?? 'Échec upload.' });
      return;
    }

    setFiles((prev) => {
      if (!isAnnex) return [...prev.filter((f) => f.type_document !== 'Manuscrit_Principal'), data];
      return [...prev, data];
    });
    setMessage({ type: 'success', text: `Fichier « ${data.file_name} » ajouté.` });
  };

  const handleSave = async (statut: 'Brouillon' | 'Soumis') => {
    if (!user) return;
    if (!abstractId) {
      setMessage({ type: 'error', text: 'Sélectionnez un résumé de référence.' });
      return;
    }
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Le titre est obligatoire.' });
      return;
    }
    if (statut === 'Soumis') {
      if (!motsCles.trim()) {
        setMessage({ type: 'error', text: 'Les mots-clés sont obligatoires.' });
        return;
      }
      if (!declarationConflit || !declarationPlagiat) {
        setMessage({ type: 'error', text: 'Cochez les deux déclarations éthiques.' });
        return;
      }
      if (!hasMainManuscript(files)) {
        setMessage({ type: 'error', text: 'Le manuscrit principal (PDF ou Word) est obligatoire.' });
        return;
      }
    }

    setSaving(true);
    const payload = {
      abstract_id: abstractId,
      author_id: user.id,
      titre: title.trim(),
      mots_cles: motsCles.trim() || null,
      declaration_conflit: declarationConflit,
      declaration_plagiat: declarationPlagiat,
      statut,
      updated_at: new Date().toISOString(),
    };

    let targetId = articleId;
    if (articleId) {
      const { error } = await supabase.from('full_articles').update(payload).eq('id', articleId);
      if (error) {
        setSaving(false);
        setMessage({ type: 'error', text: error.message });
        return;
      }
    } else {
      const { data, error } = await supabase.from('full_articles').insert(payload).select('id').single();
      if (error || !data) {
        setSaving(false);
        setMessage({ type: 'error', text: error?.message ?? 'Erreur création.' });
        return;
      }
      targetId = data.id;
      setArticleId(data.id);
    }

    setSaving(false);
    setMessage({ type: 'success', text: statut === 'Brouillon' ? 'Brouillon enregistré.' : 'Article soumis avec succès !' });
    if (statut === 'Soumis') {
      setTimeout(() => router.push('/dashboard/articles-complets'), 1200);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Chargement…</div>;
  }

  const mainFile = files.find((f) => f.type_document === 'Manuscrit_Principal');
  const annexFiles = files.filter((f) => f.type_document === 'Annexes');
  const guidePublished = isInstructionDocumentPublished(instructionsDoc);

  const handleGuideDownload = async () => {
    if (!instructionsDoc.storage_path) return;
    const url = await getEventDocumentSignedUrl(supabase, instructionsDoc.storage_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setMessage({ type: 'error', text: 'Impossible de télécharger le guide.' });
  };

  return (
    <div className="editor-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)', gap: '20px', alignItems: 'start' }}>
      <div className="editor-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {message && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}>
            {message.text}
          </div>
        )}

        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
          Réservé aux résumés acceptés par le comité scientifique.
        </p>

        <div className="form-group">
          <label>Résumé de référence <span style={{ color: 'red' }}>*</span></label>
          <select
            value={abstractId}
            disabled={Boolean(editId)}
            onChange={(e) => handleAbstractChange(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '8px', fontSize: '13px' }}
          >
            <option value="">Sélectionnez le résumé rattaché</option>
            {acceptedAbstracts.map((a) => (
              <option key={a.id} value={a.id}>{a.titre} (Accepté)</option>
            ))}
          </select>
          {acceptedAbstracts.length === 0 && (
            <p style={{ fontSize: '12px', color: '#b45309', marginTop: '8px' }}>
              Aucun résumé accepté disponible pour un nouvel article.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Titre de l&apos;article complet <span style={{ color: 'red' }}>*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de votre article" style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        <div className="form-group">
          <label>Mots-clés <span style={{ color: 'red' }}>*</span></label>
          <input type="text" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} placeholder="nutrition, pédiatrie, carences" style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        <div className="form-group">
          <label>Manuscrit complet (PDF ou Word) <span style={{ color: 'red' }}>*</span></label>
          {mainFile ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
              <button type="button" onClick={async () => { const u = await getArticleFileSignedUrl(supabase, mainFile.file_url); if (u) window.open(u, '_blank'); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px' }}>📄 {mainFile.file_name}</button>
              <button type="button" onClick={async () => { await deleteArticleFileRecord(supabase, mainFile); setFiles((p) => p.filter((f) => f.id !== mainFile.id)); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Supprimer</button>
            </div>
          ) : (
            <>
              <input ref={mainInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFileUpload(f, false); }} />
              <button type="button" disabled={uploading} onClick={() => mainInputRef.current?.click()} style={{ width: '100%', marginTop: '8px', padding: '16px', border: '2px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', fontSize: '13px' }}>
                {uploading ? 'Envoi…' : '📄 Uploader le document principal (max 20 Mo)'}
              </button>
            </>
          )}
        </div>

        <div className="form-group">
          <label>Fichiers supplémentaires (optionnel)</label>
          <input ref={annexInputRef} type="file" accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png,.xlsx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFileUpload(f, true); }} />
          <button type="button" disabled={uploading} onClick={() => annexInputRef.current?.click()} style={{ width: '100%', marginTop: '8px', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px', color: '#2563eb' }}>
            + Ajouter une annexe
          </button>
          {annexFiles.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '12px' }}>
              <span>📎 {f.file_name}</span>
              <button type="button" onClick={async () => { await deleteArticleFileRecord(supabase, f); setFiles((p) => p.filter((x) => x.id !== f.id)); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px' }}>Déclarations éthiques</h4>
          <label style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={declarationConflit} onChange={(e) => setDeclarationConflit(e.target.checked)} />
            Je déclare n&apos;avoir aucun conflit d&apos;intérêt majeur concernant cette recherche.
          </label>
          <label style={{ display: 'flex', gap: '10px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={declarationPlagiat} onChange={(e) => setDeclarationPlagiat(e.target.checked)} />
            J&apos;accepte que mon article soit soumis à un logiciel de détection de plagiat.
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button type="button" disabled={saving} onClick={() => handleSave('Brouillon')} style={{ padding: '6px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>
            {saving ? '…' : 'Enregistrer brouillon'}
          </button>
          <button type="button" disabled={saving} onClick={() => handleSave('Soumis')} style={{ padding: '6px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            {saving ? '…' : 'Soumettre l\'article'}
          </button>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 55%, #ffffff 100%)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #bfdbfe',
        position: 'sticky',
        top: '20px',
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: '6px' }}>
              Guide officiel
            </div>
            <h3 style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 6px', lineHeight: 1.35 }}>
              {instructionsDoc.title}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              {instructionsDoc.description}
            </p>
          </div>
          <span style={{
            flexShrink: 0,
            background: '#ffffff',
            color: '#1e40af',
            fontSize: '10px',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #bfdbfe',
          }}>
            {guidePublished ? instructionFormatLabel(instructionsDoc.format) : 'En attente'}
          </span>
        </div>

        {guidePublished ? (
          <button
            type="button"
            onClick={handleGuideDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '11px 14px',
              marginBottom: '14px',
              background: '#1e3a5f',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30,58,95,0.25)',
            }}
          >
            <span>📥</span>
            Télécharger le guide ({instructionFormatLabel(instructionsDoc.format)})
          </button>
        ) : (
          <div style={{
            padding: '12px 14px',
            marginBottom: '14px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#92400e',
            lineHeight: 1.5,
          }}>
            Le guide officiel n&apos;a pas encore été publié par l&apos;organisateur. Revenez plus tard ou contactez le secrétariat scientifique.
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#334155' }}>Points clés</p>
          <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <li>Police Times New Roman 12pt, interligne 1,5</li>
            <li>Maximum 6 000 mots</li>
            <li>Références style APA 7e édition</li>
            <li>Manuscrit principal obligatoire à la soumission</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
