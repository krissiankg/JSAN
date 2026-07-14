"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type AbstractAuthor,
  type AbstractFile,
  ABSTRACT_SELECT,
  DEFAULT_PRESENTATION_TYPES,
  DEFAULT_THEMES,
  parseJsonArray,
} from '@/lib/abstracts';
import {
  type UploadRules,
  DEFAULT_UPLOAD_RULES,
  deleteAbstractFileRecord,
  parseUploadRules,
  uploadAbstractFile,
  getAbstractFileSignedUrl,
  validateAbstractFile,
} from '@/lib/abstract-files';
import {
  type InstructionDocument,
  DEFAULT_RESUME_INSTRUCTIONS,
  instructionFormatLabel,
  isInstructionDocumentPublished,
  parseDocumentsConfig,
} from '@/lib/author-instructions';
import { getEventDocumentSignedUrl } from '@/lib/event-documents';
import { notifyAbstractSubmitted } from '@/lib/notifications';

interface AuthorFormRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
  isSpeaker: boolean;
}

const THEME_PLACEHOLDER = 'Sélectionnez une thématique';
const TYPE_PLACEHOLDER = 'Sélectionnez le type';

export default function SubmitAbstractPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [authors, setAuthors] = useState<AuthorFormRow[]>([
    { id: 1, firstName: '', lastName: '', email: '', institution: '', isSpeaker: true },
  ]);
  const [theme, setTheme] = useState(THEME_PLACEHOLDER);
  const [presentationType, setPresentationType] = useState(TYPE_PLACEHOLDER);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [themesList, setThemesList] = useState(DEFAULT_THEMES);
  const [presentationTypes, setPresentationTypes] = useState(DEFAULT_PRESENTATION_TYPES);
  const [abstractId, setAbstractId] = useState<string | null>(editId);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<AbstractFile[]>([]);
  const [uploadRules, setUploadRules] = useState<UploadRules>(DEFAULT_UPLOAD_RULES);
  const [instructionsDoc, setInstructionsDoc] = useState<InstructionDocument>(DEFAULT_RESUME_INSTRUCTIONS);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) setIsThemeOpen(false);
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) setIsTypeOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('events_config').select('themes_disponibles, types_presentation, upload_rules, documents_config').limit(1).maybeSingle();
      if (data) {
        const themes = parseJsonArray(data.themes_disponibles);
        const types = parseJsonArray(data.types_presentation);
        if (themes.length) setThemesList(themes);
        if (types.length) setPresentationTypes(types);
        setUploadRules(parseUploadRules(data.upload_rules));
        setInstructionsDoc(parseDocumentsConfig(data.documents_config).instructions_resume);
      }
    }
    loadConfig();
  }, [supabase]);

  const loadAbstract = useCallback(async () => {
    if (!editId || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('abstracts')
      .select(ABSTRACT_SELECT)
      .eq('id', editId)
      .eq('author_id', user.id)
      .single();

    if (error || !data) {
      setMessage({ type: 'error', text: 'Brouillon introuvable.' });
      setLoading(false);
      return;
    }

    setAbstractId(data.id);
    setTitle(data.titre ?? '');
    setAbstract(data.contenu_texte ?? '');
    setKeywords(data.mots_cles ?? '');
    setTheme(data.thematique ?? THEME_PLACEHOLDER);
    setPresentationType(data.type_presentation_global ?? TYPE_PLACEHOLDER);

    if (data.abstract_authors?.length) {
      setAuthors(
        data.abstract_authors.map((a: AbstractAuthor, i: number) => ({
          id: i + 1,
          firstName: a.prenom,
          lastName: a.nom,
          email: a.email,
          institution: a.affiliation,
          isSpeaker: a.est_orateur,
        }))
      );
    }
    setFiles(data.abstract_files ?? []);
    setLoading(false);
  }, [editId, user, supabase]);

  useEffect(() => {
    if (profile && !editId) {
      setAuthors([{
        id: 1,
        firstName: profile.prenom ?? '',
        lastName: profile.nom ?? '',
        email: user?.email ?? '',
        institution: profile.institution ?? '',
        isSpeaker: true,
      }]);
    }
  }, [profile, user, editId]);

  useEffect(() => {
    loadAbstract();
  }, [loadAbstract]);

  const updateAuthor = (id: number, field: keyof AuthorFormRow, value: string | boolean) => {
    setAuthors((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const addAuthor = () => {
    setAuthors([...authors, { id: Date.now(), firstName: '', lastName: '', email: '', institution: '', isSpeaker: false }]);
  };

  const removeAuthor = (idToRemove: number) => {
    setAuthors(authors.filter((a) => a.id !== idToRemove));
  };

  const validateForm = (forSubmit: boolean) => {
    if (!title.trim()) return 'Le titre est obligatoire.';
    if (forSubmit) {
      if (theme === THEME_PLACEHOLDER) return 'Sélectionnez une thématique.';
      if (presentationType === TYPE_PLACEHOLDER) return 'Sélectionnez un type de présentation.';
      if (!keywords.trim()) return 'Les mots-clés sont obligatoires.';
      if (!abstract.trim()) return 'Le contenu du résumé est obligatoire.';
    }
    return null;
  };

  const saveAuthors = async (targetAbstractId: string) => {
    await supabase.from('abstract_authors').delete().eq('abstract_id', targetAbstractId);
    const rows = authors
      .filter((a) => a.firstName.trim() || a.lastName.trim())
      .map((a, index) => ({
        abstract_id: targetAbstractId,
        nom: a.lastName.trim() || '—',
        prenom: a.firstName.trim() || '—',
        email: a.email.trim() || user?.email || '',
        affiliation: a.institution.trim() || '—',
        est_orateur: a.isSpeaker,
        ordre_affichage: index,
      }));
    if (rows.length) {
      await supabase.from('abstract_authors').insert(rows);
    }
  };

  const buildPayload = (statut: 'Brouillon' | 'Soumis') => ({
    author_id: user!.id,
    titre: title.trim() || 'Sans titre',
    contenu_texte: abstract.trim() || null,
    mots_cles: keywords.trim() || null,
    thematique: theme !== THEME_PLACEHOLDER ? theme : null,
    type_presentation_global: presentationType !== TYPE_PLACEHOLDER ? presentationType : null,
    statut,
    updated_at: new Date().toISOString(),
  });

  const ensureAbstractSaved = async (): Promise<string | null> => {
    if (!user) return null;
    if (abstractId) return abstractId;

    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Saisissez un titre avant d\'ajouter un fichier.' });
      return null;
    }

    const { data, error } = await supabase
      .from('abstracts')
      .insert(buildPayload('Brouillon'))
      .select('id')
      .single();

    if (error || !data) {
      setMessage({ type: 'error', text: error?.message ?? 'Impossible de créer le brouillon.' });
      return null;
    }

    setAbstractId(data.id);
    await saveAuthors(data.id);
    return data.id;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected || !user) return;

    const validationError = validateAbstractFile(selected, uploadRules, files.length);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setUploading(true);
    setMessage(null);

    const targetId = await ensureAbstractSaved();
    if (!targetId) {
      setUploading(false);
      return;
    }

    const { data, error } = await uploadAbstractFile(supabase, user.id, targetId, selected);
    setUploading(false);

    if (error || !data) {
      setMessage({ type: 'error', text: error ?? 'Échec de l\'upload.' });
      return;
    }

    setFiles((prev) => [...prev, data]);
    setMessage({ type: 'success', text: `Fichier « ${data.file_name} » ajouté.` });
  };

  const handleFileDelete = async (file: AbstractFile) => {
    if (!confirm(`Supprimer « ${file.file_name} » ?`)) return;
    setDeletingFileId(file.id);
    const error = await deleteAbstractFileRecord(supabase, file);
    setDeletingFileId(null);

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    setMessage({ type: 'success', text: 'Fichier supprimé.' });
  };

  const handleFileDownload = async (file: AbstractFile) => {
    const url = await getAbstractFileSignedUrl(supabase, file.file_url);
    if (!url) {
      setMessage({ type: 'error', text: 'Impossible de télécharger ce fichier.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGuideDownload = async () => {
    if (instructionsDoc.public_url && !instructionsDoc.storage_path) {
      window.open(instructionsDoc.public_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!instructionsDoc.storage_path) return;
    const url = await getEventDocumentSignedUrl(supabase, instructionsDoc.storage_path);
    if (!url) {
      setMessage({ type: 'error', text: 'Impossible de télécharger le guide.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const guidePublished = isInstructionDocumentPublished(instructionsDoc);

  const handleSave = async (statut: 'Brouillon' | 'Soumis') => {
    if (!user) return;
    const validationError = validateForm(statut === 'Soumis');
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = buildPayload(statut);

    let targetId = abstractId;

    if (abstractId) {
      const { error } = await supabase.from('abstracts').update(payload).eq('id', abstractId);
      if (error) {
        setSaving(false);
        setMessage({ type: 'error', text: error.message });
        return;
      }
    } else {
      const { data, error } = await supabase.from('abstracts').insert(payload).select('id').single();
      if (error || !data) {
        setSaving(false);
        setMessage({ type: 'error', text: error?.message ?? 'Erreur lors de la création.' });
        return;
      }
      targetId = data.id;
      setAbstractId(data.id);
    }

    if (targetId) await saveAuthors(targetId);

    setSaving(false);
    setMessage({
      type: 'success',
      text: statut === 'Brouillon' ? 'Brouillon enregistré.' : 'Résumé soumis avec succès !',
    });

    if (statut === 'Soumis' && targetId && user) {
      void notifyAbstractSubmitted(supabase, user.id, targetId, title.trim());
      setTimeout(() => router.push('/dashboard/mes-resumes'), 1200);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Chargement du brouillon…</div>;
  }

  return (
    <div className="editor-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 350px)', gap: '30px', alignItems: 'start' }}>
      <div className="editor-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

        <div className="form-group">
          <label>Titre du résumé <span className="required" style={{ color: 'red' }}>*</span></label>
          <input type="text" className="form-input" placeholder="Titre de votre recherche" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} />
        </div>

        <div className="form-group" ref={themeRef}>
          <label>Thématique <span className="required" style={{ color: 'red' }}>*</span></label>
          <div style={{ position: 'relative', marginTop: '8px' }}>
            <div onClick={() => setIsThemeOpen(!isThemeOpen)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: theme === THEME_PLACEHOLDER ? '#94a3b8' : '#1e293b', fontSize: '13px' }}>
              <span>{theme}</span><span>▼</span>
            </div>
            {isThemeOpen && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', listStyle: 'none', padding: '8px 0', zIndex: 1000, maxHeight: '250px', overflowY: 'auto' }}>
                {themesList.map((t) => (
                  <li key={t} onClick={() => { setTheme(t); setIsThemeOpen(false); }} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Mots-clés <span className="required" style={{ color: 'red' }}>*</span></label>
          <input type="text" className="form-input" placeholder="nutrition, santé, obésité" value={keywords} onChange={(e) => setKeywords(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} />
        </div>

        <div className="form-group">
          <label>Contenu principal (Abstract) <span className="required" style={{ color: 'red' }}>*</span></label>
          <textarea className="editor-textarea" placeholder="Contexte, Méthodologie, Résultats, Conclusion…" rows={12} value={abstract} onChange={(e) => setAbstract(e.target.value)} style={{ width: '100%', padding: '15px', border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label>Pièces jointes</label>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 12px' }}>
            Jusqu&apos;à {uploadRules.max_files} fichier(s), {uploadRules.max_size_mb} Mo max — {uploadRules.allowed_extensions.join(', ')}
          </p>

          {files.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((file) => (
                <li key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span>📄</span>
                    <button type="button" onClick={() => handleFileDownload(file)} style={{ background: 'none', border: 'none', padding: 0, color: '#1B6B2E', cursor: 'pointer', fontSize: '13px', fontWeight: 500, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={deletingFileId === file.id}
                    onClick={() => handleFileDelete(file)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
                  >
                    {deletingFileId === file.id ? '…' : 'Supprimer'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={uploadRules.allowed_extensions.map((ext) => `.${ext}`).join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            disabled={uploading || files.length >= uploadRules.max_files}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              background: '#fff',
              color: files.length >= uploadRules.max_files ? '#94a3b8' : '#1B6B2E',
              cursor: files.length >= uploadRules.max_files ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {uploading ? 'Envoi en cours…' : files.length >= uploadRules.max_files ? 'Limite de fichiers atteinte' : '+ Ajouter un fichier'}
          </button>
          {!abstractId && (
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
              Un brouillon sera créé automatiquement à l&apos;ajout du premier fichier (titre requis).
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
          <button type="button" disabled={saving} onClick={() => handleSave('Brouillon')} className="btn btn-outline" style={{ padding: '6px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>
            {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
          </button>
          <button type="button" disabled={saving} onClick={() => handleSave('Soumis')} className="btn btn-primary" style={{ padding: '6px 16px', backgroundColor: '#1B6B2E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            {saving ? 'Envoi…' : 'Soumettre'}
          </button>
        </div>
      </div>

      <div className="editor-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '25px', position: 'sticky', top: '20px', minWidth: 0 }}>

        <div style={{
          background: 'linear-gradient(160deg, #E8F5EC 0%, #f8fafc 55%, #ffffff 100%)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #B7DFC0',
          minWidth: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#145224', marginBottom: '6px' }}>
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
              color: '#145224',
              fontSize: '10px',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #B7DFC0',
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
              <li>Structure IMRC : contexte, méthodologie, résultats, conclusion</li>
              <li>250 à 300 mots · 3 à 6 mots-clés</li>
              <li>Un orateur désigné · co-auteurs complets</li>
              <li>Pièces jointes : max {uploadRules.max_files} fichiers, {uploadRules.max_size_mb} Mo</li>
            </ul>
            <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              {guidePublished
                ? 'Téléchargez le document officiel pour les consignes détaillées.'
                : 'Les points clés ci-dessus restent valables en attendant la publication du guide.'}
            </p>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: 0 }} ref={typeRef}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Type de présentation</h3>
          <div style={{ position: 'relative' }}>
            <div onClick={() => setIsTypeOpen(!isTypeOpen)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: presentationType === TYPE_PLACEHOLDER ? '#94a3b8' : '#1e293b', fontSize: '13px' }}>
              <span>{presentationType}</span><span>▼</span>
            </div>
            {isTypeOpen && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', listStyle: 'none', padding: '8px 0', zIndex: 1000, maxHeight: '250px', overflowY: 'auto' }}>
                {presentationTypes.map((t) => (
                  <li key={t} onClick={() => { setPresentationType(t); setIsTypeOpen(false); }} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '0.85rem' }}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: 0, overflow: 'hidden' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Auteurs et Co-auteurs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {authors.map((author, index) => (
              <div key={author.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Auteur {index + 1}</div>
                  {index > 0 && <button type="button" onClick={() => removeAuthor(author.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px', minWidth: 0 }}>
                    <input type="text" placeholder="Prénom" value={author.firstName} onChange={(e) => updateAuthor(author.id, 'firstName', e.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                    <input type="text" placeholder="Nom" value={author.lastName} onChange={(e) => updateAuthor(author.id, 'lastName', e.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                  </div>
                  <input type="email" placeholder="Email" value={author.email} onChange={(e) => updateAuthor(author.id, 'email', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                  <input type="text" placeholder="Institution" value={author.institution} onChange={(e) => updateAuthor(author.id, 'institution', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                    <input type="checkbox" checked={author.isSpeaker} onChange={(e) => updateAuthor(author.id, 'isSpeaker', e.target.checked)} /> Orateur
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAuthor} style={{ width: '100%', border: '1px dashed #cbd5e1', background: 'transparent', padding: '10px', marginTop: '15px', borderRadius: '6px', color: '#1B6B2E', cursor: 'pointer', fontSize: '13px' }}>
            + Ajouter un co-auteur
          </button>
        </div>
      </div>
    </div>
  );
}
