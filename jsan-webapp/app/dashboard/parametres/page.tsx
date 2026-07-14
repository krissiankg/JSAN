"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { isEventStaff } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import {
  buildInstructionsArticlePayload,
  buildInstructionsResumePayload,
  buildEvaluationCriteriaPayload,
  DEFAULT_ARTICLE_INSTRUCTIONS,
  DEFAULT_RESUME_INSTRUCTIONS,
  DEFAULT_EVALUATION_CRITERIA,
  instructionFormatLabel,
  isInstructionDocumentPublished,
  parseDocumentsConfig,
  type InstructionConfigKey,
  type InstructionDocument,
} from '@/lib/author-instructions';
import {
  INSTRUCTION_ALLOWED_EXTENSIONS,
  INSTRUCTIONS_ARTICLE_FOLDER,
  INSTRUCTIONS_RESUME_FOLDER,
  removeInstructionDocument,
  uploadInstructionDocument,
} from '@/lib/event-documents';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  updateMaintenanceSettings,
} from '@/lib/maintenance';
import {
  DEFAULT_REGISTRATIONS_CLOSED_MESSAGE,
  updateRegistrationsSettings,
} from '@/lib/registrations';
import {
  fetchAttestationSettings,
  updateAttestationSettings,
} from '@/lib/attestations';
import { fetchDoubleBlindEnabled, setDoubleBlindEnabled } from '@/lib/review-mode';
import CommitteeSettingsPanel from '@/components/dashboard/CommitteeSettingsPanel';
import { OFFICIAL_PUBLIC_DOCS } from '@/lib/official-docs';

const CRITERES_FOLDER = 'criteres-evaluation';

const cardBase: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  padding: '20px 22px',
  border: '1px solid #e2e8f0',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
};

function StatusToggleRow({
  active,
  activeLabel,
  inactiveLabel,
  activeHint,
  inactiveHint,
  activeBtn,
  inactiveBtn,
  busy,
  disabled,
  onToggle,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeHint: string;
  inactiveHint: string;
  activeBtn: string;
  inactiveBtn: string;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 14px',
        background: active ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${active ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: '10px',
        marginBottom: '14px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: active ? '#166534' : '#b45309', marginBottom: '2px', fontSize: '14px' }}>
          {active ? activeLabel : inactiveLabel}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
          {active ? activeHint : inactiveHint}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onToggle}
        style={{
          flexShrink: 0,
          border: 'none',
          borderRadius: '8px',
          padding: '9px 14px',
          fontWeight: 600,
          fontSize: '13px',
          cursor: disabled || busy ? 'not-allowed' : 'pointer',
          background: active ? '#b45309' : '#166534',
          color: '#fff',
          opacity: disabled || busy ? 0.7 : 1,
        }}
      >
        {busy ? '…' : active ? activeBtn : inactiveBtn}
      </button>
    </div>
  );
}

function GuideUploadBlock({
  title,
  description,
  doc,
  uploading,
  removing,
  disabled,
  onUpload,
  onRemove,
}: {
  title: string;
  description: string;
  doc: InstructionDocument;
  uploading: boolean;
  removing: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={cardBase}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>{description}</p>

      {isInstructionDocumentPublished(doc) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            marginBottom: '14px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📄 {doc.file_name}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              {instructionFormatLabel(doc.format)}
              {doc.uploaded_at && ` · ${new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}`}
              {doc.public_url && !doc.storage_path && ' · fichier officiel'}
            </div>
            {doc.public_url && !doc.storage_path && (
              <a href={doc.public_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#1B6B2E', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>
                Ouvrir →
              </a>
            )}
          </div>
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: '1px solid #fca5a5',
              color: '#dc2626',
              padding: '7px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {removing ? '…' : 'Retirer'}
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 14px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            marginBottom: '14px',
            fontSize: '13px',
            color: '#92400e',
            lineHeight: 1.45,
          }}
        >
          Aucun guide publié. Les auteurs verront un message d&apos;attente.
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={INSTRUCTION_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onUpload(file);
          }}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          disabled={uploading || disabled}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '8px',
            border: 'none',
            background: '#0f172a',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            cursor: uploading || disabled ? 'not-allowed' : 'pointer',
            opacity: uploading || disabled ? 0.7 : 1,
          }}
        >
          {uploading
            ? 'Publication en cours…'
            : isInstructionDocumentPublished(doc)
              ? 'Remplacer le document'
              : 'Publier le guide (PDF ou Word)'}
        </button>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0' }}>
          Formats : {INSTRUCTION_ALLOWED_EXTENSIONS.join(', ')} — max 20 Mo
        </p>
      </div>
    </div>
  );
}

export default function ParametresPage() {
  const { user, userRole } = useAuth();
  const supabase = createClient();

  const [eventConfigId, setEventConfigId] = useState<string | null>(null);
  const [resumeInstructions, setResumeInstructions] = useState<InstructionDocument>(DEFAULT_RESUME_INSTRUCTIONS);
  const [articleInstructions, setArticleInstructions] = useState<InstructionDocument>(DEFAULT_ARTICLE_INSTRUCTIONS);
  const [criteresEvaluation, setCriteresEvaluation] = useState<InstructionDocument>(DEFAULT_EVALUATION_CRITERIA);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingArticle, setUploadingArticle] = useState(false);
  const [uploadingCriteres, setUploadingCriteres] = useState(false);
  const [removingResume, setRemovingResume] = useState(false);
  const [removingArticle, setRemovingArticle] = useState(false);
  const [removingCriteres, setRemovingCriteres] = useState(false);
  const [guideMessage, setGuideMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [registrationsClosedMessage, setRegistrationsClosedMessage] = useState(
    DEFAULT_REGISTRATIONS_CLOSED_MESSAGE
  );
  const [registrationsSaving, setRegistrationsSaving] = useState(false);
  const [attestationsEnabled, setAttestationsEnabled] = useState(false);
  const [attestationsSaving, setAttestationsSaving] = useState(false);
  const [doubleBlindEnabled, setDoubleBlindEnabledState] = useState(true);
  const [doubleBlindSaving, setDoubleBlindSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events_config')
        .select('id, documents_config, maintenance_mode, maintenance_message, registrations_open, registrations_closed_message, double_aveugle_actif')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setEventConfigId(data.id);
        const config = parseDocumentsConfig(data.documents_config);
        setResumeInstructions(config.instructions_resume);
        setArticleInstructions(config.instructions_article);
        setCriteresEvaluation(config.criteres_evaluation);
        setMaintenanceEnabled(Boolean(data.maintenance_mode));
        setMaintenanceMessage(data.maintenance_message?.trim() || DEFAULT_MAINTENANCE_MESSAGE);
        setRegistrationsOpen(data.registrations_open !== false);
        setRegistrationsClosedMessage(
          data.registrations_closed_message?.trim() || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE
        );
        setDoubleBlindEnabledState(data.double_aveugle_actif !== false);
      }
      const { settings: attSettings } = await fetchAttestationSettings(supabase);
      if (attSettings) {
        setAttestationsEnabled(attSettings.attestations_enabled);
      }
      if (!data) {
        const blind = await fetchDoubleBlindEnabled(supabase);
        setDoubleBlindEnabledState(blind);
      }
    }
    load();
  }, [supabase]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs et super administrateurs peuvent accéder aux paramètres.</p>
      </div>
    );
  }

  const persistInstructionDoc = async (key: InstructionConfigKey, next: InstructionDocument) => {
    if (!eventConfigId) return 'Configuration événement introuvable.';
    const current = await supabase.from('events_config').select('documents_config').eq('id', eventConfigId).single();
    const base = (current.data?.documents_config && typeof current.data.documents_config === 'object')
      ? current.data.documents_config as Record<string, unknown>
      : {};

    const { error } = await supabase
      .from('events_config')
      .update({ documents_config: { ...base, [key]: next } })
      .eq('id', eventConfigId);

    return error?.message ?? null;
  };

  const handleGuideUpload = async (
    key: InstructionConfigKey,
    folder: string,
    currentDoc: InstructionDocument,
    setDoc: (doc: InstructionDocument) => void,
    setUploading: (v: boolean) => void,
    buildPayload: typeof buildInstructionsResumePayload,
    file: File
  ) => {
    if (!user || !eventConfigId) return;

    setUploading(true);
    setGuideMessage(null);

    const { storagePath, error: uploadError } = await uploadInstructionDocument(supabase, eventConfigId, file, folder);
    if (uploadError) {
      setUploading(false);
      setGuideMessage({ type: 'error', text: uploadError });
      return;
    }

    if (currentDoc.storage_path) {
      await removeInstructionDocument(supabase, currentDoc.storage_path);
    }

    const payload = buildPayload(currentDoc, storagePath, file.name, user.id);
    const saveError = await persistInstructionDoc(key, payload);
    setUploading(false);

    if (saveError) {
      await removeInstructionDocument(supabase, storagePath);
      setGuideMessage({ type: 'error', text: saveError });
      return;
    }

    setDoc(parseDocumentsConfig({ [key]: payload })[key]);
    setGuideMessage({ type: 'success', text: 'Guide publié — visible par les auteurs.' });
  };

  const handleGuideRemove = async (
    key: InstructionConfigKey,
    currentDoc: InstructionDocument,
    setDoc: (doc: InstructionDocument) => void,
    setRemoving: (v: boolean) => void
  ) => {
    if (!isInstructionDocumentPublished(currentDoc)) return;
    if (!confirm('Retirer ce document (revenir au fichier officiel par défaut si disponible) ?')) return;

    setRemoving(true);
    setGuideMessage(null);

    const oldPath = currentDoc.storage_path;
    const cleared: InstructionDocument =
      key === 'instructions_resume'
        ? { ...DEFAULT_RESUME_INSTRUCTIONS }
        : key === 'criteres_evaluation'
          ? { ...DEFAULT_EVALUATION_CRITERIA }
          : key === 'instructions_article'
            ? { ...DEFAULT_ARTICLE_INSTRUCTIONS }
            : { title: currentDoc.title, description: currentDoc.description };

    const saveError = await persistInstructionDoc(key, cleared);
    if (saveError) {
      setRemoving(false);
      setGuideMessage({ type: 'error', text: saveError });
      return;
    }

    if (oldPath) await removeInstructionDocument(supabase, oldPath);
    setDoc(cleared);
    setRemoving(false);
    setGuideMessage({ type: 'success', text: 'Document mis à jour.' });
  };

  const handleMaintenanceToggle = async () => {
    if (!eventConfigId) return;
    setMaintenanceSaving(true);
    setGuideMessage(null);
    const next = !maintenanceEnabled;
    const err = await updateMaintenanceSettings(supabase, eventConfigId, {
      enabled: next,
      message: maintenanceMessage,
    });
    setMaintenanceSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setMaintenanceEnabled(next);
    setGuideMessage({
      type: 'success',
      text: next
        ? 'Mode maintenance activé — le public voit la page de maintenance.'
        : 'Mode maintenance désactivé — le site est de nouveau accessible.',
    });
  };

  const handleMaintenanceMessageSave = async () => {
    if (!eventConfigId) return;
    setMaintenanceSaving(true);
    setGuideMessage(null);
    const err = await updateMaintenanceSettings(supabase, eventConfigId, {
      enabled: maintenanceEnabled,
      message: maintenanceMessage,
    });
    setMaintenanceSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setGuideMessage({ type: 'success', text: 'Message de maintenance enregistré.' });
  };

  const handleRegistrationsToggle = async () => {
    if (!eventConfigId) return;
    setRegistrationsSaving(true);
    setGuideMessage(null);
    const next = !registrationsOpen;
    const err = await updateRegistrationsSettings(supabase, eventConfigId, {
      open: next,
      message: registrationsClosedMessage,
    });
    setRegistrationsSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setRegistrationsOpen(next);
    setGuideMessage({
      type: 'success',
      text: next
        ? 'Inscriptions ouvertes — les nouveaux comptes peuvent s’inscrire.'
        : 'Inscriptions fermées — la page /register affiche un message de fermeture.',
    });
  };

  const handleRegistrationsMessageSave = async () => {
    if (!eventConfigId) return;
    setRegistrationsSaving(true);
    setGuideMessage(null);
    const err = await updateRegistrationsSettings(supabase, eventConfigId, {
      open: registrationsOpen,
      message: registrationsClosedMessage,
    });
    setRegistrationsSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setGuideMessage({ type: 'success', text: 'Message d’inscriptions fermées enregistré.' });
  };

  const handleAttestationsToggle = async () => {
    if (!eventConfigId) return;
    setAttestationsSaving(true);
    setGuideMessage(null);
    const next = !attestationsEnabled;
    const err = await updateAttestationSettings(supabase, eventConfigId, next);
    setAttestationsSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setAttestationsEnabled(next);
    setGuideMessage({
      type: 'success',
      text: next
        ? 'Téléchargement des attestations ouvert — les utilisateurs voient leurs documents.'
        : 'Téléchargement des attestations fermé.',
    });
  };

  const handleDoubleBlindToggle = async () => {
    if (!eventConfigId) return;
    setDoubleBlindSaving(true);
    setGuideMessage(null);
    const next = !doubleBlindEnabled;
    const err = await setDoubleBlindEnabled(supabase, eventConfigId, next);
    setDoubleBlindSaving(false);
    if (err) {
      setGuideMessage({ type: 'error', text: err });
      return;
    }
    setDoubleBlindEnabledState(next);
    setGuideMessage({
      type: 'success',
      text: next
        ? 'Double aveugle activé — les évaluateurs ne voient pas l’identité des auteurs.'
        : 'Double aveugle désactivé — les évaluateurs peuvent voir le nom des auteurs.',
    });
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    lineHeight: 1.5,
    resize: 'vertical',
    marginBottom: '10px',
    fontFamily: 'inherit',
  };

  const saveBtnStyle = (busy: boolean): React.CSSProperties => ({
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 14px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: !eventConfigId || busy ? 'not-allowed' : 'pointer',
    opacity: !eventConfigId || busy ? 0.7 : 1,
    alignSelf: 'flex-start',
  });

  return (
    <div className="page-shell">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>Paramètres</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
          Accès public, inscriptions, attestations et guides auteurs.
        </p>
      </div>

      {guideMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: guideMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: guideMessage.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${guideMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {guideMessage.text}
        </div>
      )}

      {/* Accès plateforme — 2 colonnes */}
      <section style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
          Accès plateforme
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              ...cardBase,
              background: maintenanceEnabled ? '#fffbeb' : '#fff',
              border: `1px solid ${maintenanceEnabled ? '#fde68a' : '#e2e8f0'}`,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Mode maintenance</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
              Le public voit une page « Site en maintenance ». Les organisateurs gardent l&apos;accès via <code>/login</code>.
            </p>

            <StatusToggleRow
              active={!maintenanceEnabled}
              activeLabel="Site public ouvert"
              inactiveLabel="Maintenance active"
              activeHint="Tout le monde peut accéder normalement."
              inactiveHint="Visiteurs et non-staff sont redirigés."
              activeBtn="Activer maintenance"
              inactiveBtn="Désactiver"
              busy={maintenanceSaving}
              disabled={!eventConfigId}
              onToggle={handleMaintenanceToggle}
            />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Message affiché au public
            </label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={3}
              style={textareaStyle}
            />
            <button
              type="button"
              disabled={!eventConfigId || maintenanceSaving}
              onClick={handleMaintenanceMessageSave}
              style={saveBtnStyle(maintenanceSaving)}
            >
              Enregistrer le message
            </button>
          </div>

          <div
            style={{
              ...cardBase,
              background: registrationsOpen ? '#fff' : '#fffbeb',
              border: `1px solid ${registrationsOpen ? '#e2e8f0' : '#fde68a'}`,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Inscriptions</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
              Fermez la création de nouveaux comptes sans bloquer le site ni la connexion des comptes existants.
            </p>

            <StatusToggleRow
              active={registrationsOpen}
              activeLabel="Inscriptions ouvertes"
              inactiveLabel="Inscriptions fermées"
              activeHint="Création de compte possible via /register."
              inactiveHint="/login reste disponible pour les comptes existants."
              activeBtn="Fermer"
              inactiveBtn="Ouvrir"
              busy={registrationsSaving}
              disabled={!eventConfigId}
              onToggle={handleRegistrationsToggle}
            />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Message si inscriptions fermées
            </label>
            <textarea
              value={registrationsClosedMessage}
              onChange={(e) => setRegistrationsClosedMessage(e.target.value)}
              rows={3}
              style={textareaStyle}
            />
            <button
              type="button"
              disabled={!eventConfigId || registrationsSaving}
              onClick={handleRegistrationsMessageSave}
              style={saveBtnStyle(registrationsSaving)}
            >
              Enregistrer le message
            </button>
          </div>
        </div>
      </section>

      {/* Attestations + Paiements — bandeau */}
      <section style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
          Services
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          <div
            style={{
              ...cardBase,
              background: attestationsEnabled ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${attestationsEnabled ? '#bbf7d0' : '#fde68a'}`,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Attestations</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
              Contrôlez quand les participants peuvent télécharger leurs attestations.
            </p>
            <StatusToggleRow
              active={attestationsEnabled}
              activeLabel="Téléchargement ouvert"
              inactiveLabel="Téléchargement fermé"
              activeHint="Visibles dans l’espace Attestations."
              inactiveHint="Invisibles côté participant."
              activeBtn="Fermer"
              inactiveBtn="Ouvrir"
              busy={attestationsSaving}
              disabled={!eventConfigId}
              onToggle={handleAttestationsToggle}
            />
          </div>

          <div
            style={{
              ...cardBase,
              background: doubleBlindEnabled ? '#E8F5EC' : '#fff',
              border: `1px solid ${doubleBlindEnabled ? '#B7DFC0' : '#e2e8f0'}`,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Évaluation en double aveugle</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
              Quand c&apos;est actif, les évaluateurs ne voient ni le nom ni l&apos;affiliation des auteurs (RLS + interface).
            </p>
            <StatusToggleRow
              active={doubleBlindEnabled}
              activeLabel="Double aveugle actif"
              inactiveLabel="Identités visibles"
              activeHint="Auteurs anonymes pour les évaluateurs."
              inactiveHint="Les évaluateurs voient le nom de l’auteur."
              activeBtn="Désactiver"
              inactiveBtn="Activer"
              busy={doubleBlindSaving}
              disabled={!eventConfigId}
              onToggle={handleDoubleBlindToggle}
            />
          </div>

          <div style={cardBase}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Paiements &amp; Billetterie</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5, flex: 1 }}>
              Liens Kkiapay par billet, clés API et suivi des paiements.
            </p>
            <Link
              href="/dashboard/admin/paiements"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0f172a',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
                alignSelf: 'flex-start',
              }}
            >
              Ouvrir la configuration →
            </Link>
          </div>
        </div>
      </section>

      {/* Guides officiels */}
      <section>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
          Documents officiels
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
          Programme PDF :{' '}
          <a href={OFFICIAL_PUBLIC_DOCS.programme.path} target="_blank" rel="noopener noreferrer" style={{ color: '#1B6B2E', fontWeight: 600 }}>
            {OFFICIAL_PUBLIC_DOCS.programme.fileName}
          </a>
          {' · '}téléchargeable depuis le tableau de bord et la page Programme.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'stretch',
          }}
        >
          <GuideUploadBlock
            title="Instructions aux auteurs"
            description="Document officiel pour la soumission d’un résumé (défaut : PDF fourni)."
            doc={resumeInstructions}
            uploading={uploadingResume}
            removing={removingResume}
            disabled={!eventConfigId}
            onUpload={(file) => handleGuideUpload(
              'instructions_resume', INSTRUCTIONS_RESUME_FOLDER, resumeInstructions, setResumeInstructions,
              setUploadingResume, buildInstructionsResumePayload, file
            )}
            onRemove={() => handleGuideRemove('instructions_resume', resumeInstructions, setResumeInstructions, setRemovingResume)}
          />

          <GuideUploadBlock
            title="Guide — articles complets"
            description="Document officiel (PDF ou Word) pour la soumission d’un article."
            doc={articleInstructions}
            uploading={uploadingArticle}
            removing={removingArticle}
            disabled={!eventConfigId}
            onUpload={(file) => handleGuideUpload(
              'instructions_article', INSTRUCTIONS_ARTICLE_FOLDER, articleInstructions, setArticleInstructions,
              setUploadingArticle, buildInstructionsArticlePayload, file
            )}
            onRemove={() => handleGuideRemove('instructions_article', articleInstructions, setArticleInstructions, setRemovingArticle)}
          />

          <GuideUploadBlock
            title="Critères d’évaluation"
            description="Grille pour les évaluateurs (défaut : PDF fourni)."
            doc={criteresEvaluation}
            uploading={uploadingCriteres}
            removing={removingCriteres}
            disabled={!eventConfigId}
            onUpload={(file) => handleGuideUpload(
              'criteres_evaluation', CRITERES_FOLDER, criteresEvaluation, setCriteresEvaluation,
              setUploadingCriteres, buildEvaluationCriteriaPayload, file
            )}
            onRemove={() => handleGuideRemove('criteres_evaluation', criteresEvaluation, setCriteresEvaluation, setRemovingCriteres)}
          />
        </div>
      </section>

      <CommitteeSettingsPanel />
    </div>
  );
}
