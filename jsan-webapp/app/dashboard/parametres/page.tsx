"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { isEventStaff } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import {
  buildInstructionsArticlePayload,
  buildInstructionsResumePayload,
  DEFAULT_ARTICLE_INSTRUCTIONS,
  DEFAULT_RESUME_INSTRUCTIONS,
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
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>{description}</p>

      {isInstructionDocumentPublished(doc) ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '16px',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📄 {doc.file_name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              {instructionFormatLabel(doc.format)}
              {doc.uploaded_at && ` · Publié le ${new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}`}
            </div>
          </div>
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            style={{ flexShrink: 0, background: 'transparent', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {removing ? '…' : 'Retirer'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '16px', fontSize: '0.9rem', color: '#92400e' }}>
          Aucun guide publié. Les auteurs verront un message d&apos;attente sur le formulaire.
        </div>
      )}

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
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          background: '#1e3a5f', color: '#fff', fontWeight: 600, fontSize: '0.95rem',
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
      <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '8px' }}>
        Formats : {INSTRUCTION_ALLOWED_EXTENSIONS.join(', ')} — max 20 Mo
      </p>
    </div>
  );
}

export default function ParametresPage() {
  const { user, userRole } = useAuth();
  const supabase = createClient();

  const [eventConfigId, setEventConfigId] = useState<string | null>(null);
  const [resumeInstructions, setResumeInstructions] = useState<InstructionDocument>(DEFAULT_RESUME_INSTRUCTIONS);
  const [articleInstructions, setArticleInstructions] = useState<InstructionDocument>(DEFAULT_ARTICLE_INSTRUCTIONS);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingArticle, setUploadingArticle] = useState(false);
  const [removingResume, setRemovingResume] = useState(false);
  const [removingArticle, setRemovingArticle] = useState(false);
  const [guideMessage, setGuideMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [registrationsClosedMessage, setRegistrationsClosedMessage] = useState(
    DEFAULT_REGISTRATIONS_CLOSED_MESSAGE
  );
  const [registrationsSaving, setRegistrationsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events_config')
        .select('id, documents_config, maintenance_mode, maintenance_message, registrations_open, registrations_closed_message')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setEventConfigId(data.id);
        const config = parseDocumentsConfig(data.documents_config);
        setResumeInstructions(config.instructions_resume);
        setArticleInstructions(config.instructions_article);
        setMaintenanceEnabled(Boolean(data.maintenance_mode));
        setMaintenanceMessage(data.maintenance_message?.trim() || DEFAULT_MAINTENANCE_MESSAGE);
        setRegistrationsOpen(data.registrations_open !== false);
        setRegistrationsClosedMessage(
          data.registrations_closed_message?.trim() || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE
        );
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
    if (!confirm('Retirer ce guide des auteurs ?')) return;

    setRemoving(true);
    setGuideMessage(null);

    const oldPath = currentDoc.storage_path;
    const cleared: InstructionDocument = {
      title: currentDoc.title,
      description: currentDoc.description,
    };

    const saveError = await persistInstructionDoc(key, cleared);
    if (saveError) {
      setRemoving(false);
      setGuideMessage({ type: 'error', text: saveError });
      return;
    }

    await removeInstructionDocument(supabase, oldPath);
    setDoc(cleared);
    setRemoving(false);
    setGuideMessage({ type: 'success', text: 'Guide retiré.' });
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

  return (
    <div style={{ padding: '30px', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {guideMessage && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: guideMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: guideMessage.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${guideMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
          fontSize: '0.9rem',
        }}>
          {guideMessage.text}
        </div>
      )}

      <div style={{
        background: maintenanceEnabled ? '#fffbeb' : '#ffffff',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: `1px solid ${maintenanceEnabled ? '#fde68a' : '#e2e8f0'}`,
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
          Mode maintenance
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
          Activez cette option pendant vos tests en production. Le public verra une page sobre « Site en maintenance ».
          Les comptes <strong>organisateur</strong> et <strong>super admin</strong> conservent l&apos;accès complet via <code>/login</code>.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '14px 16px',
          background: maintenanceEnabled ? '#fef3c7' : '#f8fafc',
          border: `1px solid ${maintenanceEnabled ? '#fcd34d' : '#e2e8f0'}`,
          borderRadius: '10px',
          marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: maintenanceEnabled ? '#b45309' : '#166534', marginBottom: '4px' }}>
              {maintenanceEnabled ? 'Maintenance active' : 'Site public ouvert'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {maintenanceEnabled
                ? 'Les visiteurs et utilisateurs non-staff sont redirigés.'
                : 'Tout le monde peut accéder normalement au site.'}
            </div>
          </div>
          <button
            type="button"
            disabled={!eventConfigId || maintenanceSaving}
            onClick={handleMaintenanceToggle}
            style={{
              flexShrink: 0,
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: !eventConfigId || maintenanceSaving ? 'not-allowed' : 'pointer',
              background: maintenanceEnabled ? '#166534' : '#b45309',
              color: '#fff',
              opacity: !eventConfigId || maintenanceSaving ? 0.7 : 1,
            }}
          >
            {maintenanceSaving ? '…' : maintenanceEnabled ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
          Message affiché au public
        </label>
        <textarea
          value={maintenanceMessage}
          onChange={(e) => setMaintenanceMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            resize: 'vertical',
            marginBottom: '12px',
          }}
        />
        <button
          type="button"
          disabled={!eventConfigId || maintenanceSaving}
          onClick={handleMaintenanceMessageSave}
          style={{
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: !eventConfigId || maintenanceSaving ? 'not-allowed' : 'pointer',
            opacity: !eventConfigId || maintenanceSaving ? 0.7 : 1,
          }}
        >
          Enregistrer le message
        </button>
      </div>

      <div style={{
        background: registrationsOpen ? '#ffffff' : '#fffbeb',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: `1px solid ${registrationsOpen ? '#e2e8f0' : '#fde68a'}`,
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
          Inscriptions plateforme
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
          Fermez les inscriptions pour empêcher la création de nouveaux comptes (participant, auteur, évaluateur),
          tout en laissant le site public et la connexion accessibles aux comptes existants.
          Distinct du mode maintenance ci-dessus.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '14px 16px',
          background: registrationsOpen ? '#f0fdf4' : '#fef3c7',
          border: `1px solid ${registrationsOpen ? '#bbf7d0' : '#fcd34d'}`,
          borderRadius: '10px',
          marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: registrationsOpen ? '#166534' : '#b45309', marginBottom: '4px' }}>
              {registrationsOpen ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {registrationsOpen
                ? 'Tout le monde peut créer un compte via /register.'
                : 'Les visiteurs voient « Inscriptions closes » — /login reste disponible.'}
            </div>
          </div>
          <button
            type="button"
            disabled={!eventConfigId || registrationsSaving}
            onClick={handleRegistrationsToggle}
            style={{
              flexShrink: 0,
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: !eventConfigId || registrationsSaving ? 'not-allowed' : 'pointer',
              background: registrationsOpen ? '#b45309' : '#166534',
              color: '#fff',
              opacity: !eventConfigId || registrationsSaving ? 0.7 : 1,
            }}
          >
            {registrationsSaving ? '…' : registrationsOpen ? 'Fermer' : 'Ouvrir'}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
          Message affiché lorsque les inscriptions sont fermées
        </label>
        <textarea
          value={registrationsClosedMessage}
          onChange={(e) => setRegistrationsClosedMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            resize: 'vertical',
            marginBottom: '12px',
          }}
        />
        <button
          type="button"
          disabled={!eventConfigId || registrationsSaving}
          onClick={handleRegistrationsMessageSave}
          style={{
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: !eventConfigId || registrationsSaving ? 'not-allowed' : 'pointer',
            opacity: !eventConfigId || registrationsSaving ? 0.7 : 1,
          }}
        >
          Enregistrer le message
        </button>
      </div>

      <GuideUploadBlock
        title="Guide — soumission des résumés"
        description="Document officiel (PDF ou Word) téléchargé par les auteurs lors de la soumission d'un résumé."
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
        description="Document officiel (PDF ou Word) téléchargé par les auteurs lors de la soumission d'un article complet."
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

      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '12px' }}>Paiements &amp; Billetterie</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
          La billetterie fonctionne désormais avec des <strong>liens de paiement Kkiapay par billet</strong>.
          Créez un lien de paiement dans votre tableau de bord Kkiapay pour chaque billet,
          puis renseignez les URL dans la page dédiée.
        </p>
        <Link
          href="/dashboard/admin/paiements"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: '8px',
            fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
          }}
        >
          Configurer les liens de paiement →
        </Link>
      </div>
    </div>
  );
}
