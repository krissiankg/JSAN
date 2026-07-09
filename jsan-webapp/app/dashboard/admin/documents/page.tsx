"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import AttestationPreviewSheet from '@/components/dashboard/AttestationPreviewSheet';
import { isEventStaff } from '@/lib/roles';
import {
  ATTESTATION_TEMPLATES,
  ATTESTATION_TYPE_LABELS,
  buildDefaultAttestationBody,
  createAttestation,
  createAttestationsBulk,
  deleteAttestation,
  fetchAttestationSettings,
  fetchAttestationsForStaff,
  formatAttestationDate,
  roleTextForAttestationType,
  type AttestationType,
  type AttestationSettings,
  type UserAttestation,
  type UserAttestationInput,
  updateAttestation,
  updateAttestationSettings,
} from '@/lib/attestations';
import { fetchAllUsersForStaff, formatUserDisplayName, type StaffUserRow } from '@/lib/users-admin';

type FormState = UserAttestationInput;

const EMPTY_FORM: FormState = {
  user_id: '',
  attestation_type: 'organisation',
  titre: 'ATTESTATION',
  designation: 'DE MERITE',
  recipient_label: 'Monsieur',
  recipient_name: '',
  intro_text: 'Cette attestation certifie que:',
  body_text: '',
  footer_text: 'Pour servir et valoir ce que de droit.',
  reference_code: '',
  issued_on: new Date().toISOString().slice(0, 10),
  signatory_left_name: 'MCA S. Colette AZANDJEME',
  signatory_left_title: 'Présidente du comité d’organisation',
  signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
  signatory_right_title: 'Président de la Société de Nutrition du Bénin',
  is_active: true,
};

export default function AdminDocuments() {
  const { userRole } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<AttestationSettings | null>(null);
  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [attestations, setAttestations] = useState<UserAttestation[]>([]);
  const [paidTicketUserIds, setPaidTicketUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [showBulkPreview, setShowBulkPreview] = useState(false);
  const [visualPreviewUserId, setVisualPreviewUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, staffUsers, docs, paidTickets] = await Promise.all([
      fetchAttestationSettings(supabase),
      fetchAllUsersForStaff(supabase),
      fetchAttestationsForStaff(supabase),
      supabase.from('tickets_registrations').select('user_id').eq('statut_paiement', 'Paye'),
    ]);
    setSettings(cfg);
    setUsers(staffUsers);
    setAttestations(docs);
    setPaidTicketUserIds([...
      new Set(((paidTickets.data ?? []) as Array<{ user_id: string | null }>).map((row) => row.user_id).filter(Boolean) as string[])
    ]);
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
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer les documents.</p>
      </div>
    );
  }

  const usersById = new Map(users.map((u) => [u.id, u]));
  const paidTicketSet = new Set(paidTicketUserIds);
  const existingAttestationKeys = new Set(attestations.map((att) => `${att.user_id}:${att.attestation_type}`));

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedUser = usersById.get(form.user_id);

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setMessage(null);
  };

  const openEdit = (att: UserAttestation) => {
    setEditingId(att.id);
    setForm({
      user_id: att.user_id,
      attestation_type: att.attestation_type,
      titre: att.titre,
      designation: att.designation ?? '',
      recipient_label: att.recipient_label ?? 'Monsieur',
      recipient_name: att.recipient_name,
      intro_text: att.intro_text ?? 'Cette attestation certifie que:',
      body_text: att.body_text,
      footer_text: att.footer_text ?? 'Pour servir et valoir ce que de droit.',
      reference_code: att.reference_code ?? '',
      issued_on: att.issued_on ?? new Date().toISOString().slice(0, 10),
      signatory_left_name: att.signatory_left_name ?? '',
      signatory_left_title: att.signatory_left_title ?? '',
      signatory_right_name: att.signatory_right_name ?? '',
      signatory_right_title: att.signatory_right_title ?? '',
      is_active: att.is_active,
    });
    setMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const autofillBody = () => {
    const fullName = form.recipient_name.trim() || formatUserDisplayName(selectedUser ?? { prenom: null, nom: null });
    setField('body_text', buildDefaultAttestationBody({ fullName, roleText: roleTextForAttestationType(form.attestation_type) }));
  };

  const handleToggleRelease = async () => {
    if (!settings) return;
    const err = await updateAttestationSettings(supabase, settings.id, !settings.attestations_enabled);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSettings({ ...settings, attestations_enabled: !settings.attestations_enabled });
    setMessage({
      type: 'success',
      text: !settings.attestations_enabled
        ? 'Le téléchargement des attestations est maintenant ouvert aux utilisateurs.'
        : 'Le téléchargement des attestations a été refermé.',
    });
  };

  const handleSave = async () => {
    if (!form.user_id) {
      setMessage({ type: 'error', text: 'Sélectionnez un utilisateur.' });
      return;
    }
    if (!form.titre.trim() || !form.recipient_name.trim() || !form.body_text.trim()) {
      setMessage({ type: 'error', text: "Titre, bénéficiaire et corps de l'attestation sont obligatoires." });
      return;
    }
    setSaving(true);
    const err =
      editingId === 'new'
        ? await createAttestation(supabase, form)
        : await updateAttestation(supabase, editingId!, form);
    setSaving(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: editingId === 'new' ? 'Attestation créée.' : 'Attestation mise à jour.' });
    closeForm();
    await load();
  };

  const handleDelete = async (att: UserAttestation) => {
    if (!confirm(`Supprimer l'attestation de ${att.recipient_name} ?`)) return;
    const err = await deleteAttestation(supabase, att.id);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Attestation supprimée.' });
    await load();
  };

  const toggleBulkUser = (userId: string) => {
    setBulkSelection((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleBulkGenerate = async () => {
    const err = await createAttestationsBulk(
      supabase,
      users.map((u) => ({ id: u.id, fullName: formatUserDisplayName(u) })),
      {
        userIds: bulkSelection,
        attestation_type: form.attestation_type,
        titre: form.titre,
        designation: form.designation,
        intro_text: form.intro_text,
        footer_text: form.footer_text,
        reference_prefix: form.reference_code,
        issued_on: form.issued_on,
        signatory_left_name: form.signatory_left_name,
        signatory_left_title: form.signatory_left_title,
        signatory_right_name: form.signatory_right_name,
        signatory_right_title: form.signatory_right_title,
        is_active: form.is_active,
      }
    );
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Attestations générées en lot.' });
    setBulkSelection([]);
    setShowBulkPreview(false);
    await load();
  };

  const applyTemplate = (templateId: string) => {
    const template = ATTESTATION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      attestation_type: template.attestation_type,
      titre: template.titre,
      designation: template.designation,
      intro_text: template.intro_text,
      footer_text: template.footer_text,
      signatory_left_name: template.signatory_left_name,
      signatory_left_title: template.signatory_left_title,
      signatory_right_name: template.signatory_right_name,
      signatory_right_title: template.signatory_right_title,
      reference_code: template.reference_prefix,
      body_text: prev.recipient_name
        ? buildDefaultAttestationBody({
            fullName: prev.recipient_name,
            roleText: roleTextForAttestationType(template.attestation_type),
          })
        : prev.body_text,
    }));
    setMessage({ type: 'success', text: `Modèle « ${template.label} » appliqué.` });
  };

  const applyBulkPreset = (preset: 'all' | 'paid' | 'participants' | 'authors' | 'evaluators' | 'organizers' | 'verified') => {
    const ids = users.filter((user) => {
      switch (preset) {
        case 'paid':
          return paidTicketSet.has(user.id);
        case 'participants':
          return user.role === 'participant';
        case 'authors':
          return user.role === 'auteur';
        case 'evaluators':
          return user.role === 'pair_valide';
        case 'organizers':
          return user.role === 'organisateur' || user.role === 'admin' || user.role === 'superadmin';
        case 'verified':
          return user.is_student_verified || user.is_member_verified;
        case 'all':
        default:
          return true;
      }
    }).map((user) => user.id);
    setBulkSelection(ids);
  };

  const applySuggestedPreset = () => {
    if (form.attestation_type === 'participation') {
      applyBulkPreset('paid');
      return;
    }
    if (form.attestation_type === 'evaluation') {
      applyBulkPreset('evaluators');
      return;
    }
    if (form.attestation_type === 'organisation' || form.attestation_type === 'merite') {
      applyBulkPreset('organizers');
      return;
    }
    if (form.attestation_type === 'communication' || form.attestation_type === 'publication') {
      applyBulkPreset('authors');
      return;
    }
    applyBulkPreset('all');
  };

  const filteredBulkUsers = users.filter((user) => {
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return true;
    return [
      formatUserDisplayName(user),
      user.role,
      user.telephone ?? '',
    ].join(' ').toLowerCase().includes(q);
  });
  const previewUsers = users
    .filter((user) => bulkSelection.includes(user.id))
    .map((user, index) => ({
      ...user,
      fullName: formatUserDisplayName(user),
      reference: form.reference_code ? `${form.reference_code}-${index + 1}` : null,
      alreadyExists: existingAttestationKeys.has(`${user.id}:${form.attestation_type}`),
      body: buildDefaultAttestationBody({
        fullName: formatUserDisplayName(user),
        roleText: roleTextForAttestationType(form.attestation_type),
      }),
    }));
  const visualPreviewUser = usersById.get(visualPreviewUserId ?? '');
  const visualPreviewAttestation = visualPreviewUser
    ? {
        titre: form.titre,
        designation: form.designation ?? '',
        intro_text: form.intro_text ?? 'Cette attestation certifie que:',
        recipient_label: form.recipient_label ?? 'Monsieur',
        recipient_name: formatUserDisplayName(visualPreviewUser),
        body_text: buildDefaultAttestationBody({
          fullName: formatUserDisplayName(visualPreviewUser),
          roleText: roleTextForAttestationType(form.attestation_type),
        }),
        footer_text: form.footer_text ?? 'Pour servir et valoir ce que de droit.',
        reference_code: form.reference_code ? `${form.reference_code}-${Math.max(1, bulkSelection.indexOf(visualPreviewUser.id) + 1)}` : null,
        issued_on: form.issued_on ?? null,
        signatory_left_name: form.signatory_left_name ?? '',
        signatory_left_title: form.signatory_left_title ?? '',
        signatory_right_name: form.signatory_right_name ?? '',
        signatory_right_title: form.signatory_right_title ?? '',
      }
    : null;

  return (
    <div style={{ padding: '30px', maxWidth: '1150px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Attestations &amp; Documents</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '740px' }}>
            Créez des attestations personnalisées selon le modèle JSAN et choisissez vous-même quand les utilisateurs peuvent commencer à les télécharger.
          </p>
        </div>
        {!editingId && (
          <button type="button" onClick={openNew} style={buttonPrimary}>
            + Nouvelle attestation
          </button>
        )}
      </div>

      <div style={{ background: settings?.attestations_enabled ? '#f0fdf4' : '#fffbeb', border: `1px solid ${settings?.attestations_enabled ? '#bbf7d0' : '#fde68a'}`, borderRadius: '12px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, color: settings?.attestations_enabled ? '#166534' : '#b45309', marginBottom: '4px' }}>
              {settings?.attestations_enabled ? 'Téléchargement ouvert' : 'Téléchargement fermé'}
            </div>
            <div style={{ fontSize: '13px', color: settings?.attestations_enabled ? '#166534' : '#92400e' }}>
              Tant que ce bouton n'est pas ouvert, les utilisateurs ne voient pas leurs attestations dans leur espace.
            </div>
          </div>
          {settings && (
            <button type="button" onClick={handleToggleRelease} style={{ ...buttonPrimary, background: settings.attestations_enabled ? '#92400e' : '#166534' }}>
              {settings.attestations_enabled ? 'Fermer les téléchargements' : 'Ouvrir les téléchargements'}
            </button>
          )}
        </div>
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

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Modèles prédéfinis</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
          Applique rapidement un modèle standard avant la génération simple ou en lot.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ATTESTATION_TEMPLATES.map((template) => (
            <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} style={buttonSecondary}>
              {template.label}
            </button>
          ))}
        </div>
      </section>

      {editingId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 16px' }}>{editingId === 'new' ? 'Créer une attestation' : "Modifier l'attestation"}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Utilisateur</label>
              <select
                style={inputStyle}
                value={form.user_id}
                onChange={(e) => {
                  const userId = e.target.value;
                  const user = usersById.get(userId);
                  setField('user_id', userId);
                  if (user) {
                    setField('recipient_name', formatUserDisplayName(user));
                  }
                }}
              >
                <option value="">— Choisir un bénéficiaire —</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{formatUserDisplayName(user)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.attestation_type} onChange={(e) => setField('attestation_type', e.target.value as AttestationType)}>
                {Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Référence</label>
              <input style={inputStyle} value={form.reference_code ?? ''} onChange={(e) => setField('reference_code', e.target.value)} placeholder="57-25/ATT-SG/PR/CA-SNB" />
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={form.issued_on ?? ''} onChange={(e) => setField('issued_on', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre principal</label>
              <input style={inputStyle} value={form.titre} onChange={(e) => setField('titre', e.target.value)} placeholder="ATTESTATION" />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Sous-titre / désignation</label>
              <input style={inputStyle} value={form.designation ?? ''} onChange={(e) => setField('designation', e.target.value)} placeholder="DE MERITE" />
            </div>

            <div>
              <label style={labelStyle}>Civilité</label>
              <input style={inputStyle} value={form.recipient_label ?? ''} onChange={(e) => setField('recipient_label', e.target.value)} placeholder="Monsieur / Madame" />
            </div>

            <div>
              <label style={labelStyle}>Nom du bénéficiaire</label>
              <input style={inputStyle} value={form.recipient_name} onChange={(e) => setField('recipient_name', e.target.value)} placeholder="Monsieur X" />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Texte d'introduction</label>
              <input style={inputStyle} value={form.intro_text ?? ''} onChange={(e) => setField('intro_text', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Corps de l'attestation</label>
                <button type="button" onClick={autofillBody} style={{ ...buttonSecondary, padding: '6px 10px' }}>
                  Préremplir
                </button>
              </div>
              <textarea style={{ ...inputStyle, minHeight: '130px' }} value={form.body_text} onChange={(e) => setField('body_text', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Texte de pied</label>
              <input style={inputStyle} value={form.footer_text ?? ''} onChange={(e) => setField('footer_text', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Signataire gauche</label>
              <input style={inputStyle} value={form.signatory_left_name ?? ''} onChange={(e) => setField('signatory_left_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Titre signataire gauche</label>
              <textarea style={{ ...inputStyle, minHeight: '58px' }} value={form.signatory_left_title ?? ''} onChange={(e) => setField('signatory_left_title', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Signataire droite</label>
              <input style={inputStyle} value={form.signatory_right_name ?? ''} onChange={(e) => setField('signatory_right_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Titre signataire droite</label>
              <textarea style={{ ...inputStyle, minHeight: '58px' }} value={form.signatory_right_title ?? ''} onChange={(e) => setField('signatory_right_title', e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setField('is_active', e.target.checked)} />
                Attestation active
              </label>
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

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Génération en lot</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
          Utilise le modèle courant du formulaire ci-dessus (type, titre, signataires, date, référence-prefixe) pour créer plusieurs attestations d'un coup.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button type="button" onClick={applySuggestedPreset} style={buttonSecondary}>Suggestion selon le type</button>
          <button type="button" onClick={() => applyBulkPreset('paid')} style={buttonSecondary}>Participants payés</button>
          <button type="button" onClick={() => applyBulkPreset('authors')} style={buttonSecondary}>Auteurs</button>
          <button type="button" onClick={() => applyBulkPreset('evaluators')} style={buttonSecondary}>Évaluateurs validés</button>
          <button type="button" onClick={() => applyBulkPreset('organizers')} style={buttonSecondary}>Organisation / admins</button>
          <button type="button" onClick={() => applyBulkPreset('verified')} style={buttonSecondary}>Profils vérifiés</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button type="button" onClick={() => setBulkSelection(users.map((u) => u.id))} style={buttonSecondary}>Tout sélectionner</button>
          <button type="button" onClick={() => setBulkSelection([])} style={buttonSecondary}>Tout effacer</button>
          <button type="button" onClick={() => setShowBulkPreview(true)} disabled={!bulkSelection.length} style={{ ...buttonSecondary, opacity: bulkSelection.length ? 1 : 0.6, cursor: bulkSelection.length ? 'pointer' : 'not-allowed' }}>
            Prévisualiser
          </button>
          <button type="button" onClick={handleBulkGenerate} disabled={!bulkSelection.length} style={{ ...buttonPrimary, opacity: bulkSelection.length ? 1 : 0.6, cursor: bulkSelection.length ? 'pointer' : 'not-allowed' }}>
            Générer pour {bulkSelection.length} personne{bulkSelection.length > 1 ? 's' : ''}
          </button>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={bulkSearch}
            onChange={(e) => setBulkSearch(e.target.value)}
            placeholder="Filtrer par nom, téléphone ou rôle…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px' }}>
          {filteredBulkUsers.map((user) => {
            const checked = bulkSelection.includes(user.id);
            const alreadyExists = existingAttestationKeys.has(`${user.id}:${form.attestation_type}`);
            return (
              <label key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: checked ? '#eff6ff' : 'transparent', opacity: alreadyExists ? 0.7 : 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleBulkUser(user.id)} />
                  <span>
                    <strong>{formatUserDisplayName(user)}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>{user.role}</span>
                    {paidTicketSet.has(user.id) && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#166534', fontWeight: 700 }}>Billet payé</span>}
                    {alreadyExists && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#b45309', fontWeight: 700 }}>Déjà créé</span>}
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
              </label>
            );
          })}
        </div>
      </section>

      {showBulkPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9999, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '960px', margin: '20px auto', background: '#fff', borderRadius: '18px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>Prévisualisation avant génération en lot</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  Vérifie le type, les références, les bénéficiaires, les doublons et le rendu final avant de lancer la création.
                </p>
              </div>
              <button type="button" onClick={() => setShowBulkPreview(false)} style={buttonSecondary}>Fermer</button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px', fontSize: '13px', color: '#334155', display: 'grid', gap: '6px' }}>
              <div><strong>Type :</strong> {ATTESTATION_TYPE_LABELS[form.attestation_type]}</div>
              <div><strong>Titre :</strong> {form.titre}{form.designation ? ` — ${form.designation}` : ''}</div>
              <div><strong>Date :</strong> {form.issued_on || '—'}</div>
              <div><strong>Référence prefixe :</strong> {form.reference_code || '—'}</div>
            </div>

            <div style={{ display: 'grid', gap: '10px', maxHeight: '60vh', overflowY: 'auto' }}>
              {previewUsers.map((user) => (
                <div key={user.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', background: user.alreadyExists ? '#fff7ed' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <div>
                      <strong>{user.fullName}</strong>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>{user.role}</span>
                      {user.alreadyExists && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#b45309', fontWeight: 700 }}>Déjà une attestation de ce type</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{user.reference ?? 'Pas de référence auto'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.55, flex: 1 }}>{user.body}</div>
                    <button type="button" onClick={() => setVisualPreviewUserId(user.id)} style={{ ...buttonSecondary, padding: '6px 10px' }}>
                      Voir le rendu
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => setShowBulkPreview(false)} style={buttonSecondary}>Annuler</button>
              <button type="button" onClick={handleBulkGenerate} style={buttonPrimary}>Confirmer la génération</button>
            </div>
          </div>
        </div>
      )}

      {visualPreviewAttestation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)', zIndex: 10000, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '980px', margin: '20px auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ color: '#fff' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>Aperçu visuel final</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>{visualPreviewAttestation.recipient_name}</div>
              </div>
              <button type="button" onClick={() => setVisualPreviewUserId(null)} style={{ ...buttonSecondary, background: '#fff' }}>
                Fermer
              </button>
            </div>
            <AttestationPreviewSheet attestation={visualPreviewAttestation} compact />
          </div>
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Attestations créées ({attestations.length})</h2>
          <Link href="/dashboard/attestations" style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
            Voir la vue utilisateur →
          </Link>
        </div>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Chargement…</p>
        ) : attestations.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Aucune attestation créée pour le moment.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {attestations.map((att) => (
              <div key={att.id} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong>{att.recipient_name}</strong>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#e2e8f0', padding: '3px 8px', borderRadius: '8px' }}>
                      {ATTESTATION_TYPE_LABELS[att.attestation_type]}
                    </span>
                    {!att.is_active && <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    {att.titre}{att.designation ? ` — ${att.designation}` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {att.reference_code ? `${att.reference_code} · ` : ''}{formatAttestationDate(att.issued_on)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignSelf: 'start', flexWrap: 'wrap' }}>
                  <Link href={`/dashboard/attestations/${att.id}`} style={{ ...buttonSecondary, textDecoration: 'none' }}>
                    Aperçu
                  </Link>
                  <button type="button" onClick={() => openEdit(att)} style={buttonSecondary}>Modifier</button>
                  <button type="button" onClick={() => handleDelete(att)} style={{ ...buttonSecondary, color: '#b91c1c', borderColor: '#fca5a5' }}>Supprimer</button>
                </div>
              </div>
            ))}
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
