"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import TicketCardImage from '@/components/TicketCardImage';
import {
  type TicketTypeInput,
  type TicketTypeRow,
  createTicketType,
  deleteTicketType,
  fetchTicketTypes,
  formatFcfa,
  getTicketImageUrl,
  moveTicketTypeOrder,
  removeTicketImage,
  slugifyTicketId,
  updateTicketType,
  uploadTicketImage,
} from '@/lib/tickets';

type FormState = TicketTypeInput;

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const EMPTY_FORM: FormState = {
  id: '',
  title: '',
  description: '',
  amount: 0,
  category: 'Général',
  image_path: '',
  image_url: '',
  requires_student: false,
  requires_member: false,
  ordre: 0,
  is_active: true,
  stock_limit: null,
  sale_starts_at: null,
  sale_ends_at: null,
};

export default function AdminBilletsPage() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const [tickets, setTickets] = useState<TicketTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTickets(await fetchTicketTypes(supabase));
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
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer le catalogue des billets.</p>
      </div>
    );
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setImageFile(null);
    setMessage(null);
  };

  const openEdit = (ticket: TicketTypeRow) => {
    setEditingId(ticket.id);
    setForm({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description ?? '',
      amount: ticket.amount,
      category: ticket.category,
      image_path: ticket.image_path ?? '',
      image_url: ticket.image_url ?? '',
      requires_student: ticket.requires_student,
      requires_member: ticket.requires_member,
      ordre: ticket.ordre ?? 0,
      is_active: ticket.is_active,
      stock_limit: ticket.stock_limit,
      sale_starts_at: ticket.sale_starts_at,
      sale_ends_at: ticket.sale_ends_at,
    });
    setImageFile(null);
    setMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
  };

  const imagePreviewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return getTicketImageUrl(supabase, {
      image_path: form.image_path ?? null,
      image_url: form.image_url ?? null,
    }) || null;
  }, [imageFile, form.image_path, form.image_url, supabase]);

  useEffect(() => {
    return () => {
      if (imageFile && imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imageFile, imagePreviewUrl]);

  const handleSave = async () => {
    const ticketId = form.id.trim() || slugifyTicketId(form.title);
    if (!ticketId) {
      setMessage({ type: 'error', text: 'L’identifiant du billet est obligatoire.' });
      return;
    }
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'Le titre du billet est obligatoire.' });
      return;
    }

    setSaving(true);
    let nextForm: FormState = {
      ...form,
      id: ticketId,
      sale_starts_at: form.sale_starts_at,
      sale_ends_at: form.sale_ends_at,
    };
    if (imageFile) {
      const uploaded = await uploadTicketImage(supabase, ticketId, imageFile, form.image_path);
      if (uploaded.error) {
        setSaving(false);
        setMessage({ type: 'error', text: uploaded.error });
        return;
      }
      nextForm = {
        ...nextForm,
        image_path: uploaded.imagePath,
        image_url: '',
      };
    }

    const err =
      editingId === 'new'
        ? await createTicketType(supabase, nextForm)
        : await updateTicketType(supabase, editingId!, nextForm);
    setSaving(false);

    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }

    setMessage({ type: 'success', text: editingId === 'new' ? 'Billet ajouté.' : 'Billet mis à jour.' });
    closeForm();
    await load();
  };

  const handleDelete = async (ticket: TicketTypeRow) => {
    if (
      !confirm(
        `Supprimer le billet « ${ticket.title} » ?\n\nS’il a déjà des ventes, il sera seulement désactivé (soft-delete).`
      )
    ) {
      return;
    }
    const result = await deleteTicketType(supabase, ticket.id);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({
      type: 'success',
      text: result.softDeleted
        ? 'Billet désactivé (déjà vendu — historique conservé).'
        : 'Billet supprimé.',
    });
    await load();
  };

  const handleMove = async (ticketId: string, direction: 'up' | 'down') => {
    const err = await moveTicketTypeOrder(supabase, ticketId, direction);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    await load();
  };

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Catalogue des billets</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '720px' }}>
            Modifiez photo, titre, description, prix et contraintes (étudiant / membre) sans toucher au code.
            Les billets actifs apparaissent sur l’accueil et dans la billetterie.
          </p>
        </div>
        {!editingId && (
          <button
            type="button"
            onClick={openNew}
            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Nouveau billet
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {editingId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 16px' }}>
            {editingId === 'new' ? 'Nouveau billet' : 'Modifier le billet'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre *</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setField('title', title);
                  if (editingId === 'new') {
                    setField('id', slugifyTicketId(title));
                  }
                }}
                placeholder="Membre SNB - Étudiant"
              />
            </div>

            <div>
              <label style={labelStyle}>Identifiant</label>
              <input
                style={{
                  ...inputStyle,
                  background: '#f1f5f9',
                  color: '#64748b',
                  cursor: 'not-allowed',
                }}
                value={form.id}
                readOnly
                disabled
                tabIndex={-1}
                aria-readonly="true"
                title="Identifiant technique verrouillé"
              />
            </div>

            <div>
              <label style={labelStyle}>Catégorie</label>
              <input
                style={inputStyle}
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                placeholder="Membre SNB, Formation…"
              />
            </div>

            <div>
              <label style={labelStyle}>Prix (FCFA) *</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={500}
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value ? Number(e.target.value) : 0)}
              />
            </div>

            <div>
              <label style={labelStyle}>Stock / quota</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={form.stock_limit ?? ''}
                onChange={(e) =>
                  setField('stock_limit', e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="Illimité si vide"
              />
            </div>

            <div>
              <label style={labelStyle}>Vente à partir de</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={toDatetimeLocalValue(form.sale_starts_at)}
                onChange={(e) => setField('sale_starts_at', fromDatetimeLocalValue(e.target.value))}
              />
            </div>

            <div>
              <label style={labelStyle}>Vente jusqu’au</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={toDatetimeLocalValue(form.sale_ends_at)}
                onChange={(e) => setField('sale_ends_at', fromDatetimeLocalValue(e.target.value))}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: '70px' }}
                value={form.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Courte description affichée sur la carte billet…"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Photo</label>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '160px',
                    height: '100px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {imagePreviewUrl ? (
                    <TicketCardImage src={imagePreviewUrl} alt="Aperçu" height={100} style={{ borderRadius: 0 }} />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Aperçu</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px', flex: 1 }}>
                  <input
                    style={inputStyle}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                  <input
                    style={inputStyle}
                    type="url"
                    value={form.image_url ?? ''}
                    onChange={(e) => setField('image_url', e.target.value)}
                    placeholder="Ou URL image (secours)"
                  />
                  <div style={{ fontSize: '12px', color: '#64748b' }}>PNG, JPG, WEBP, GIF — max 5 Mo.</div>
                  {(form.image_path || form.image_url || imageFile) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (form.image_path) {
                          await removeTicketImage(supabase, form.image_path);
                        }
                        setImageFile(null);
                        setForm((prev) => ({ ...prev, image_path: '', image_url: '' }));
                      }}
                      style={{ ...buttonSecondary, width: 'fit-content' }}
                    >
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={form.requires_student ?? false}
                  onChange={(e) => setField('requires_student', e.target.checked)}
                />
                Réservé aux étudiants vérifiés
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={form.requires_member ?? false}
                  onChange={(e) => setField('requires_member', e.target.checked)}
                />
                Réservé aux membres SNB vérifiés
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(e) => setField('is_active', e.target.checked)}
                />
                Visible (actif)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={closeForm} disabled={saving} style={buttonSecondary}>
              Annuler
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={buttonPrimary}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
          <p style={{ color: '#64748b', margin: 0 }}>
            Aucun billet en base. Le site utilise encore le catalogue de secours tant que la migration n’est pas appliquée.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {tickets.map((ticket, index) => {
            const img = getTicketImageUrl(supabase, ticket);
            return (
              <div
                key={ticket.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: 5, background: ticket.is_active ? '#1B6B2E' : '#cbd5e1' }} />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '8px 0 8px 4px',
                  }}
                >
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(ticket.id, 'up')}
                    title="Monter"
                    style={{
                      ...buttonSecondary,
                      padding: '4px 8px',
                      opacity: index === 0 ? 0.4 : 1,
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === tickets.length - 1}
                    onClick={() => handleMove(ticket.id, 'down')}
                    title="Descendre"
                    style={{
                      ...buttonSecondary,
                      padding: '4px 8px',
                      opacity: index === tickets.length - 1 ? 0.4 : 1,
                      cursor: index === tickets.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↓
                  </button>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '14px 16px 14px 4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {img ? (
                      <TicketCardImage
                        src={img}
                        alt={ticket.title}
                        height={64}
                        style={{ width: '96px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        sizes="96px"
                      />
                    ) : (
                      <div
                        style={{
                          width: '96px',
                          height: '64px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          fontSize: '12px',
                        }}
                      >
                        Photo
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '16px' }}>{ticket.title}</strong>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            color: '#475569',
                          }}
                        >
                          {ticket.category}
                        </span>
                        {!ticket.is_active && (
                          <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>Inactif</span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0', fontSize: '13px', color: '#475569' }}>
                        {formatFcfa(ticket.amount)}
                        {' · '}
                        <code style={{ fontSize: '12px' }}>{ticket.id}</code>
                        {ticket.requires_student ? ' · Étudiant' : ''}
                        {ticket.requires_member ? ' · Membre' : ''}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Stock : {ticket.stock_limit == null ? 'illimité' : ticket.stock_limit}
                        {ticket.sale_starts_at
                          ? ` · Dès ${new Date(ticket.sale_starts_at).toLocaleString('fr-FR')}`
                          : ''}
                        {ticket.sale_ends_at
                          ? ` · Jusqu’au ${new Date(ticket.sale_ends_at).toLocaleString('fr-FR')}`
                          : ''}
                      </p>
                      {ticket.description && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', maxWidth: '560px' }}>
                          {ticket.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => openEdit(ticket)} style={buttonSecondary}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ticket)}
                      style={{ ...buttonSecondary, color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      {ticket.is_active ? 'Supprimer' : 'Retirer'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '4px',
  display: 'block',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
};
const buttonPrimary: React.CSSProperties = {
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  padding: '10px 20px',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
};
const buttonSecondary: React.CSSProperties = {
  background: 'transparent',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '8px 14px',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
};
