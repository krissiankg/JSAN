"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  COMMITTEE_SECTION_LABELS,
  DEFAULT_COMMISSIONS,
  createCommitteeMember,
  deleteCommitteeMember,
  fetchCommitteeMembers,
  groupCommitteeMembers,
  searchPlatformUsers,
  updateCommitteeMember,
  type CommitteeMember,
  type CommitteeMemberInput,
  type CommitteeSection,
} from '@/lib/committee';
import { OFFICIAL_PUBLIC_DOCS } from '@/lib/official-docs';

const emptyForm: CommitteeMemberInput = {
  section: 'bureau',
  commission: null,
  title: '',
  full_name: '',
  user_id: null,
  is_messaging_contact: false,
  ordre: 0,
  is_active: true,
};

export default function CommitteeSettingsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommitteeMemberInput>(emptyForm);
  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<Array<{ id: string; prenom: string | null; nom: string | null; role: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await fetchCommitteeMembers(supabase, { includeInactive: true }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(
        msg.includes('committee_members')
          ? 'Table comité introuvable. Exécutez la migration 035 dans Supabase.'
          : msg
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (userQuery.trim().length < 2) {
        setUserHits([]);
        return;
      }
      const hits = await searchPlatformUsers(supabase, userQuery);
      if (!cancelled) setUserHits(hits);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [userQuery, supabase]);

  useEffect(() => {
    if (!editingId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editingId]);

  const grouped = useMemo(() => groupCommitteeMembers(members.filter((m) => m.is_active)), [members]);
  const inactive = members.filter((m) => !m.is_active);

  const closeForm = () => {
    setEditingId(null);
    setUserHits([]);
  };

  const openNew = () => {
    setEditingId('new');
    setForm(emptyForm);
    setUserQuery('');
    setMessage(null);
    setError(null);
  };

  const openEdit = (m: CommitteeMember) => {
    setEditingId(m.id);
    setForm({
      section: m.section,
      commission: m.commission,
      title: m.title,
      full_name: m.full_name,
      user_id: m.user_id,
      is_messaging_contact: m.is_messaging_contact,
      ordre: m.ordre,
      is_active: m.is_active,
    });
    setUserQuery(m.user ? `${m.user.prenom ?? ''} ${m.user.nom ?? ''}`.trim() : '');
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.title.trim()) {
      setError('Nom et titre sont obligatoires.');
      return;
    }
    if (form.section === 'commission' && !form.commission?.trim()) {
      setError('Indiquez la commission.');
      return;
    }
    setSaving(true);
    setError(null);
    const err =
      editingId === 'new'
        ? await createCommitteeMember(supabase, form)
        : await updateCommitteeMember(supabase, editingId!, form);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setMessage(editingId === 'new' ? 'Membre ajouté.' : 'Membre mis à jour.');
    closeForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Retirer ce membre du comité ?')) return;
    const err = await deleteCommitteeMember(supabase, id);
    if (err) setError(err);
    else {
      setMessage('Membre retiré.');
      await load();
    }
  };

  const setMessaging = async (m: CommitteeMember) => {
    if (!m.user_id) {
      setError('Liez d’abord ce membre à un compte plateforme pour en faire le contact messagerie.');
      openEdit(m);
      return;
    }
    setSaving(true);
    const err = await updateCommitteeMember(supabase, m.id, { is_messaging_contact: true });
    setSaving(false);
    if (err) setError(err);
    else {
      setMessage(`${m.full_name} est maintenant le contact secrétariat (messagerie).`);
      await load();
    }
  };

  return (
    <section style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>
            Comité d’organisation
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '640px', lineHeight: 1.5 }}>
            Gérez le bureau et les commissions. Liez un membre à un compte pour qu’il reçoive les messages
            « Contacter le secrétariat ». Document source :{' '}
            <a href={OFFICIAL_PUBLIC_DOCS.comiteOrganisation.path} style={{ color: '#1B6B2E', fontWeight: 600 }}>
              {OFFICIAL_PUBLIC_DOCS.comiteOrganisation.fileName}
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{ background: '#1B6B2E', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', height: 'fit-content' }}
        >
          + Ajouter un membre
        </button>
      </div>

      {error && !editingId && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#E8F5EC', color: '#145224', fontSize: '13px', marginBottom: '12px' }}>
          {message}
        </div>
      )}

      {editingId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="committee-edit-title"
          onClick={closeForm}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '20px',
              width: 'min(640px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
          >
            <h3 id="committee-edit-title" style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>
              {editingId === 'new' ? 'Nouveau membre' : 'Modifier le membre'}
            </h3>
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <label style={labelStyle}>
                Section
                <select
                  value={form.section}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    section: e.target.value as CommitteeSection,
                    commission: e.target.value === 'commission' ? (f.commission || DEFAULT_COMMISSIONS[0]) : null,
                  }))}
                  style={inputStyle}
                >
                  {(Object.keys(COMMITTEE_SECTION_LABELS) as CommitteeSection[]).map((s) => (
                    <option key={s} value={s}>{COMMITTEE_SECTION_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              {form.section === 'commission' && (
                <label style={labelStyle}>
                  Commission
                  <select
                    value={form.commission ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
                    style={inputStyle}
                  >
                    {DEFAULT_COMMISSIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={labelStyle}>
                Titre / fonction
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Présidente, Secrétaire…" />
              </label>
              <label style={labelStyle}>
                Nom complet
                <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} style={inputStyle} placeholder="NOM Prénom" />
              </label>
              <label style={labelStyle}>
                Ordre
                <input type="number" value={form.ordre ?? 0} onChange={(e) => setForm((f) => ({ ...f, ordre: Number(e.target.value) || 0 }))} style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Lier à un compte plateforme (pour la messagerie)
                <input
                  value={userQuery}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setForm((f) => ({ ...f, user_id: null }));
                  }}
                  style={inputStyle}
                  placeholder="Rechercher prénom ou nom…"
                />
                {form.user_id && (
                  <span style={{ fontSize: '12px', color: '#1B6B2E', marginTop: '4px' }}>Compte lié ✓ — {userQuery || form.user_id}</span>
                )}
                {userHits.length > 0 && (
                  <div style={{ marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {userHits.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, user_id: u.id }));
                          setUserQuery(`${u.prenom ?? ''} ${u.nom ?? ''}`.trim());
                          setUserHits([]);
                        }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: '#fff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px' }}
                      >
                        {(u.prenom || u.nom) ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : u.id.slice(0, 8)}
                        <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{u.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.is_messaging_contact)}
                  onChange={(e) => setForm((f) => ({ ...f, is_messaging_contact: e.target.checked }))}
                />
                Contact secrétariat (messagerie)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Visible sur la page Comité
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={closeForm} style={btnSecondary}>Annuler</button>
              <button type="button" onClick={handleSave} disabled={saving} style={btnPrimary}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement du comité…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <MemberGroup
            title={COMMITTEE_SECTION_LABELS.bureau}
            members={grouped.bureau}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSetMessaging={setMessaging}
          />
          <MemberGroup
            title={COMMITTEE_SECTION_LABELS.ressource}
            members={grouped.ressources}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSetMessaging={setMessaging}
          />
          {grouped.commissions.map((c) => (
            <MemberGroup
              key={c.name}
              title={`Commission — ${c.name}`}
              members={c.members}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetMessaging={setMessaging}
            />
          ))}
          {inactive.length > 0 && (
            <MemberGroup
              title="Masqués"
              members={inactive}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetMessaging={setMessaging}
            />
          )}
        </div>
      )}
    </section>
  );
}

function MemberGroup({
  title,
  members,
  onEdit,
  onDelete,
  onSetMessaging,
}: {
  title: string;
  members: CommitteeMember[];
  onEdit: (m: CommitteeMember) => void;
  onDelete: (id: string) => void;
  onSetMessaging: (m: CommitteeMember) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
        {title} ({members.length})
      </div>
      <div>
        {members.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '10px',
              padding: '12px 16px',
              borderTop: '1px solid #f1f5f9',
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                {m.full_name}
                {m.is_messaging_contact && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: '#E8F5EC', color: '#145224', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                    Contact messagerie
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {m.title}
                {m.user_id
                  ? ` · Compte lié${m.user ? ` (${[m.user.prenom, m.user.nom].filter(Boolean).join(' ')})` : ''}`
                  : ' · Sans compte plateforme'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!m.is_messaging_contact && (
                <button type="button" onClick={() => onSetMessaging(m)} style={btnSecondary}>Contact msg</button>
              )}
              <button type="button" onClick={() => onEdit(m)} style={btnSecondary}>Modifier</button>
              <button type="button" onClick={() => onDelete(m.id)} style={{ ...btnSecondary, color: '#b91c1c', borderColor: '#fecaca' }}>Retirer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#475569' };
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 400, color: '#0f172a' };
const btnPrimary: React.CSSProperties = { background: '#1B6B2E', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' };
