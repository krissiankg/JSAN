"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type EventSponsor,
  type EventSponsorInput,
  type SponsorLevel,
  SPONSOR_LEVEL_LABELS,
  SPONSOR_LEVEL_ORDER,
  SPONSOR_LEVEL_COLORS,
  fetchSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  uploadSponsorLogo,
  removeSponsorLogo,
  getSponsorLogoUrl,
} from '@/lib/sponsors';

type FormState = EventSponsorInput;

const EMPTY_FORM: FormState = {
  nom: '',
  niveau: 'partenaire',
  description: '',
  logo_path: '',
  logo_url: '',
  website_url: '',
  couleur: '',
  ordre: 0,
  is_active: true,
  is_featured: false,
};

export default function AdminSponsors() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSponsors(await fetchSponsors(supabase));
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
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer les sponsors.</p>
      </div>
    );
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setMessage(null);
  };

  const openEdit = (sponsor: EventSponsor) => {
    setEditingId(sponsor.id);
    setForm({
      nom: sponsor.nom,
      niveau: sponsor.niveau,
      description: sponsor.description ?? '',
      logo_path: sponsor.logo_path ?? '',
      logo_url: sponsor.logo_url ?? '',
      website_url: sponsor.website_url ?? '',
      couleur: sponsor.couleur ?? '',
      ordre: sponsor.ordre ?? 0,
      is_active: sponsor.is_active,
      is_featured: sponsor.is_featured,
    });
    setLogoFile(null);
    setMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
  };

  const logoPreviewUrl = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    return getSponsorLogoUrl(supabase, {
      logo_path: form.logo_path ?? null,
      logo_url: form.logo_url ?? null,
    });
  }, [logoFile, form.logo_path, form.logo_url, supabase]);

  useEffect(() => {
    return () => {
      if (logoFile && logoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoFile, logoPreviewUrl]);

  const handleSave = async () => {
    if (!form.nom.trim()) {
      setMessage({ type: 'error', text: 'Le nom du sponsor est obligatoire.' });
      return;
    }
    setSaving(true);
    let nextForm = { ...form };
    if (logoFile) {
      const uploaded = await uploadSponsorLogo(supabase, form.nom, logoFile, form.logo_path);
      if (uploaded.error) {
        setSaving(false);
        setMessage({ type: 'error', text: uploaded.error });
        return;
      }
      nextForm = {
        ...nextForm,
        logo_path: uploaded.logoPath,
        logo_url: '',
      };
    }
    const err =
      editingId === 'new'
        ? await createSponsor(supabase, nextForm)
        : await updateSponsor(supabase, editingId!, nextForm);
    setSaving(false);

    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }

    setMessage({ type: 'success', text: editingId === 'new' ? 'Sponsor ajouté.' : 'Sponsor mis à jour.' });
    closeForm();
    await load();
  };

  const handleDelete = async (sponsor: EventSponsor) => {
    if (!confirm(`Supprimer le sponsor « ${sponsor.nom} » ?`)) return;
    const err = await deleteSponsor(supabase, sponsor.id);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Sponsor supprimé.' });
    await load();
  };

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Sponsors &amp; Partenaires</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '680px' }}>
            Gérez la visibilité des partenaires du congrès : niveau, logo, site web et ordre d'affichage.
            Les sponsors actifs apparaissent automatiquement sur la page d'accueil publique.
          </p>
        </div>
        {!editingId && (
          <button
            type="button"
            onClick={openNew}
            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Nouveau sponsor
          </button>
        )}
      </div>

      <div style={{ background: '#E8F5EC', border: '1px solid #B7DFC0', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', color: '#145224', lineHeight: 1.6 }}>
        Les logos sont maintenant <strong>uploadés dans Supabase Storage</strong>. Les anciennes URLs restent compatibles en secours.
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
          <h2 style={{ fontSize: '17px', margin: '0 0 16px' }}>{editingId === 'new' ? 'Nouveau sponsor' : 'Modifier le sponsor'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Nom *</label>
              <input style={inputStyle} value={form.nom} onChange={(e) => setField('nom', e.target.value)} placeholder="SNB, UNICEF, Ministère de la Santé..." />
            </div>

            <div>
              <label style={labelStyle}>Niveau</label>
              <select style={inputStyle} value={form.niveau} onChange={(e) => setField('niveau', e.target.value as SponsorLevel)}>
                {SPONSOR_LEVEL_ORDER.map((level) => (
                  <option key={level} value={level}>{SPONSOR_LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Ordre</label>
              <input
                style={inputStyle}
                type="number"
                value={form.ordre ?? 0}
                onChange={(e) => setField('ordre', e.target.value ? Number(e.target.value) : 0)}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Logo</label>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '120px', height: '80px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Aperçu du logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }} />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Aperçu</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px', flex: 1 }}>
                  <input
                    style={inputStyle}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Formats : PNG, JPG, WEBP, SVG. Max 5 Mo.</div>
                  {(form.logo_path || form.logo_url || logoFile) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (form.logo_path) {
                          await removeSponsorLogo(supabase, form.logo_path);
                        }
                        setLogoFile(null);
                        setForm((prev) => ({ ...prev, logo_path: '', logo_url: '' }));
                      }}
                      style={{ ...buttonSecondary, width: 'fit-content' }}
                    >
                      Retirer le logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Site web</label>
              <input style={inputStyle} type="url" value={form.website_url ?? ''} onChange={(e) => setField('website_url', e.target.value)} placeholder="https://..." />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '70px' }} value={form.description ?? ''} onChange={(e) => setField('description', e.target.value)} placeholder="Partenaire institutionnel, média, soutien logistique..." />
            </div>

            <div>
              <label style={labelStyle}>Couleur (optionnelle)</label>
              <input style={inputStyle} value={form.couleur ?? ''} onChange={(e) => setField('couleur', e.target.value)} placeholder="#0f172a" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setField('is_active', e.target.checked)} />
                Visible publiquement
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <input type="checkbox" checked={form.is_featured ?? false} onChange={(e) => setField('is_featured', e.target.checked)} />
                Mettre en avant
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

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : sponsors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
          <p style={{ color: '#64748b', margin: 0 }}>Aucun sponsor pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {sponsors.map((sponsor) => {
            const accent = sponsor.couleur || SPONSOR_LEVEL_COLORS[sponsor.niveau];
            return (
              <div key={sponsor.id} style={{ display: 'flex', gap: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ width: 5, background: accent }} />
                <div style={{ flex: 1, padding: '14px 16px 14px 4px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {getSponsorLogoUrl(supabase, sponsor) ? (
                      <img src={getSponsorLogoUrl(supabase, sponsor)!} alt={sponsor.nom} style={{ width: '72px', height: '48px', objectFit: 'contain', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '4px' }} />
                    ) : (
                      <div style={{ width: '72px', height: '48px', borderRadius: '8px', background: '#f8fafc', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        Logo
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '16px' }}>{sponsor.nom}</strong>
                        <span style={{ fontSize: '11px', fontWeight: 700, background: '#f1f5f9', padding: '3px 8px', borderRadius: '8px', color: accent }}>
                          {SPONSOR_LEVEL_LABELS[sponsor.niveau]}
                        </span>
                        {!sponsor.is_active && <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>Inactif</span>}
                        {sponsor.is_featured && <span style={{ fontSize: '11px', color: '#1B6B2E', fontWeight: 700 }}>Mise en avant</span>}
                      </div>
                      {sponsor.description && <p style={{ margin: '2px 0', fontSize: '13px', color: '#475569' }}>{sponsor.description}</p>}
                      {sponsor.website_url && (
                        <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#1B6B2E', fontWeight: 600 }}>
                          Visiter le site
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => openEdit(sponsor)} style={buttonSecondary}>Modifier</button>
                    <button type="button" onClick={() => handleDelete(sponsor)} style={{ ...buttonSecondary, color: '#b91c1c', borderColor: '#fca5a5' }}>Supprimer</button>
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

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' };
const buttonPrimary: React.CSSProperties = { background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' };
const buttonSecondary: React.CSSProperties = { background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
