"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type EventRoom,
  type EventRoomInput,
  type RoomType,
  type VisioProvider,
  ROOM_TYPE_LABELS,
  VISIO_PROVIDER_LABELS,
  ROOM_COLORS,
  fetchEventRooms,
  createEventRoom,
  updateEventRoom,
  deleteEventRoom,
  visioProviderIcon,
} from '@/lib/rooms';

type FormState = EventRoomInput;

const EMPTY: FormState = {
  nom: '',
  type: 'physique',
  capacite: null,
  lieu: '',
  visio_provider: null,
  visio_url: '',
  notes: '',
  couleur: '',
  ordre: 0,
};

export default function AdminSalles() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const [rooms, setRooms] = useState<EventRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRooms(await fetchEventRooms(supabase));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) load();
  }, [userRole, load]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Réservé aux organisateurs.</p>
      </div>
    );
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => { setForm(EMPTY); setEditingId('new'); setMessage(null); };
  const openEdit = (r: EventRoom) => {
    setForm({
      nom: r.nom,
      type: r.type,
      capacite: r.capacite,
      lieu: r.lieu ?? '',
      visio_provider: r.visio_provider,
      visio_url: r.visio_url ?? '',
      notes: r.notes ?? '',
      couleur: r.couleur ?? '',
      ordre: r.ordre ?? 0,
    });
    setEditingId(r.id);
    setMessage(null);
  };
  const closeForm = () => { setEditingId(null); setForm(EMPTY); };

  const handleSave = async () => {
    if (!form.nom.trim()) {
      setMessage({ type: 'error', text: 'Le nom est obligatoire.' });
      return;
    }
    setSaving(true);
    const err = editingId === 'new'
      ? await createEventRoom(supabase, form)
      : await updateEventRoom(supabase, editingId!, form);
    setSaving(false);
    if (err) { setMessage({ type: 'error', text: err }); return; }
    setMessage({ type: 'success', text: 'Salle enregistrée.' });
    closeForm();
    await load();
  };

  const handleDelete = async (r: EventRoom) => {
    if (!confirm(`Supprimer la salle « ${r.nom} » ?`)) return;
    const err = await deleteEventRoom(supabase, r.id);
    if (err) { setMessage({ type: 'error', text: err }); return; }
    await load();
  };

  const showVisioFields = form.type === 'virtuelle' || form.type === 'hybride';

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px' }}>Gestion des Salles</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '600px' }}>
            Créez les salles physiques, virtuelles ou hybrides du congrès. Chaque salle peut avoir son propre lien visio —
            idéal pour les <strong>sessions parallèles</strong> au même créneau horaire.
          </p>
        </div>
        {!editingId && (
          <button type="button" onClick={openNew} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            + Nouvelle salle
          </button>
        )}
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
        <strong>Visioconférence :</strong> nous ne construisons pas notre propre outil (trop complexe).
        Collez un lien <strong>Zoom</strong>, <strong>Google Meet</strong>, <strong>Teams</strong> ou <strong>Jitsi</strong> par salle virtuelle.
        Pour 3 sessions en parallèle à 14h → 3 salles virtuelles avec 3 liens distincts.
        <Link href="/dashboard/admin/visioconferences" style={{ marginLeft: '8px', color: '#2563eb', fontWeight: 600 }}>Vue visioconférences →</Link>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: message.type === 'success' ? '#dcfce7' : '#fef2f2', color: message.type === 'success' ? '#166534' : '#b91c1c', fontSize: '14px' }}>
          {message.text}
        </div>
      )}

      {editingId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 16px' }}>{editingId === 'new' ? 'Nouvelle salle' : 'Modifier la salle'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Nom *</label>
              <input style={inp} value={form.nom} onChange={(e) => setField('nom', e.target.value)} placeholder="Amphi A, Salle virtuelle 1…" />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select style={inp} value={form.type} onChange={(e) => setField('type', e.target.value as RoomType)}>
                {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((t) => (
                  <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Capacité</label>
              <input style={inp} type="number" min={0} value={form.capacite ?? ''} onChange={(e) => setField('capacite', e.target.value ? Number(e.target.value) : null)} />
            </div>
            {(form.type === 'physique' || form.type === 'hybride') && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Emplacement physique</label>
                <input style={inp} value={form.lieu ?? ''} onChange={(e) => setField('lieu', e.target.value)} placeholder="Palais des Congrès, aile B, 2e étage…" />
              </div>
            )}
            {showVisioFields && (
              <>
                <div>
                  <label style={lbl}>Outil visio</label>
                  <select style={inp} value={form.visio_provider ?? ''} onChange={(e) => setField('visio_provider', (e.target.value || null) as VisioProvider | null)}>
                    <option value="">— Détecter depuis l&apos;URL —</option>
                    {(Object.keys(VISIO_PROVIDER_LABELS) as VisioProvider[]).map((p) => (
                      <option key={p} value={p}>{VISIO_PROVIDER_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Lien visio par défaut de la salle</label>
                  <input style={inp} type="url" value={form.visio_url ?? ''} onChange={(e) => setField('visio_url', e.target.value)} placeholder="https://zoom.us/j/… (un lien par salle parallèle)" />
                </div>
              </>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight: '60px' }} value={form.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Couleur</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ROOM_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setField('couleur', c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: form.couleur === c ? '3px solid #0f172a' : '2px solid #fff', boxShadow: '0 0 0 1px #e2e8f0', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={closeForm} style={btnSec}>Annuler</button>
            <button type="button" onClick={handleSave} disabled={saving} style={btnPri}>{saving ? '…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : rooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
          <p style={{ color: '#64748b' }}>Aucune salle. Commencez par l&apos;Amphi principal et vos salles virtuelles.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {rooms.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ width: 5, background: r.couleur || '#cbd5e1' }} />
              <div style={{ flex: 1, padding: '14px 16px 14px 4px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '16px' }}>{r.nom}</strong>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#f1f5f9', padding: '3px 8px', borderRadius: '8px' }}>{ROOM_TYPE_LABELS[r.type]}</span>
                    {r.capacite != null && <span style={{ fontSize: '12px', color: '#64748b' }}>👥 {r.capacite}</span>}
                  </div>
                  {r.lieu && <p style={{ margin: '2px 0', fontSize: '13px', color: '#475569' }}>📍 {r.lieu}</p>}
                  {r.visio_url && (
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                      {visioProviderIcon(r.visio_provider)} {r.visio_provider ? VISIO_PROVIDER_LABELS[r.visio_provider] : 'Visio'} —{' '}
                      <a href={r.visio_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>lien</a>
                    </p>
                  )}
                  {r.notes && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{r.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openEdit(r)} style={btnSec}>Modifier</button>
                  <button type="button" onClick={() => handleDelete(r)} style={{ ...btnSec, color: '#b91c1c', borderColor: '#fca5a5' }}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' };
const btnPri: React.CSSProperties = { background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' };
const btnSec: React.CSSProperties = { background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
