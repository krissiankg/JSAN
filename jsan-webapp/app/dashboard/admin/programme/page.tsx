"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type AgendaSession,
  type AgendaSessionInput,
  type AcceptedAbstract,
  SESSION_TYPE_SUGGESTIONS,
  SESSION_COLORS,
  fetchAgendaSessions,
  fetchAcceptedAbstracts,
  createAgendaSession,
  updateAgendaSession,
  deleteAgendaSession,
  groupSessionsByDay,
  formatTimeRange,
} from '@/lib/agenda';
import {
  type EventRoom,
  fetchEventRooms,
  resolveSessionVisioUrl,
  resolveSessionVisioProvider,
  visioProviderIcon,
  VISIO_PROVIDER_LABELS,
} from '@/lib/rooms';

type FormState = AgendaSessionInput & { abstracts_inclus: string[] };
type ReminderAudience = 'all' | 'participants' | 'authors' | 'evaluators' | 'organizers';

const EMPTY_FORM: FormState = {
  titre: '',
  type_session: '',
  date_session: '',
  heure_debut: '',
  heure_fin: '',
  salle_nom: '',
  room_id: '',
  intervenants: '',
  lien_live_zoom: '',
  couleur: '',
  description: '',
  abstracts_inclus: [],
};

export default function AdminProgramme() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [eventRooms, setEventRooms] = useState<EventRoom[]>([]);
  const [abstracts, setAbstracts] = useState<AcceptedAbstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // editingId : null = pas de formulaire, 'new' = création, sinon = id en édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAbstracts, setShowAbstracts] = useState(false);
  const [reminderSession, setReminderSession] = useState<AgendaSession | null>(null);
  const [reminderAudience, setReminderAudience] = useState<ReminderAudience>('all');
  const [reminderNote, setReminderNote] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [notifyingProgram, setNotifyingProgram] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, a] = await Promise.all([
      fetchAgendaSessions(supabase),
      fetchEventRooms(supabase),
      fetchAcceptedAbstracts(supabase),
    ]);
    setSessions(s);
    setEventRooms(r);
    setAbstracts(a);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) load();
  }, [userRole, load]);

  const roomNames = useMemo(
    () => [...new Set([...eventRooms.map((r) => r.nom), ...sessions.map((s) => s.salle_nom).filter((n): n is string => !!n)])],
    [eventRooms, sessions]
  );
  const days = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const abstractsById = useMemo(() => new Map(abstracts.map((a) => [a.id, a])), [abstracts]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer le programme.</p>
      </div>
    );
  }

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId('new');
    setShowAbstracts(false);
    setMessage(null);
  };

  const openEdit = (s: AgendaSession) => {
    setForm({
      titre: s.titre,
      type_session: s.type_session ?? '',
      date_session: s.date_session ?? '',
      heure_debut: s.heure_debut ? s.heure_debut.slice(0, 5) : '',
      heure_fin: s.heure_fin ? s.heure_fin.slice(0, 5) : '',
      salle_nom: s.salle_nom ?? '',
      room_id: s.room_id ?? '',
      intervenants: s.intervenants ?? '',
      lien_live_zoom: s.lien_live_zoom ?? '',
      couleur: s.couleur ?? '',
      description: s.description ?? '',
      abstracts_inclus: s.abstracts_inclus ?? [],
    });
    setEditingId(s.id);
    setShowAbstracts((s.abstracts_inclus ?? []).length > 0);
    setMessage(null);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAbstract = (id: string) => {
    setForm((prev) => ({
      ...prev,
      abstracts_inclus: prev.abstracts_inclus.includes(id)
        ? prev.abstracts_inclus.filter((x) => x !== id)
        : [...prev.abstracts_inclus, id],
    }));
  };

  const handleSave = async () => {
    if (!form.titre.trim()) {
      setMessage({ type: 'error', text: 'Le titre de la session est obligatoire.' });
      return;
    }
    const isFirstSession = editingId === 'new' && sessions.length === 0;
    setSaving(true);
    const err =
      editingId === 'new'
        ? await createAgendaSession(supabase, form)
        : await updateAgendaSession(supabase, editingId!, form);
    setSaving(false);

    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: editingId === 'new' ? 'Session ajoutée.' : 'Session mise à jour.' });
    closeForm();
    await load();

    if (isFirstSession) {
      void fetch('/api/notify/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: 'program_published',
          audience: 'all',
          link: '/dashboard/programme',
          variables: { nom_evenement: 'JSAN 2025' },
        }),
      });
    }

    setTimeout(() => setMessage(null), 3000);
  };

  const notifyProgramUpdated = async () => {
    if (!confirm('Envoyer une notification « Programme mis à jour » à tous les utilisateurs ?')) return;
    setNotifyingProgram(true);
    const response = await fetch('/api/notify/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'program_updated',
        audience: 'all',
        link: '/dashboard/programme',
        variables: {
          nom_evenement: 'JSAN 2025',
          message_special: 'Consultez les dernières modifications du programme.',
        },
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; sent?: number; error?: string } | null;
    setNotifyingProgram(false);
    if (!response.ok || !result?.ok) {
      setMessage({ type: 'error', text: result?.error || 'Notification impossible.' });
      return;
    }
    setMessage({
      type: 'success',
      text: `Notification envoyée à ${result.sent ?? 0} utilisateur(s).`,
    });
  };

  const handleDelete = async (s: AgendaSession) => {
    if (!confirm(`Supprimer la session « ${s.titre} » ?`)) return;
    const err = await deleteAgendaSession(supabase, s.id);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setMessage({ type: 'success', text: 'Session supprimée.' });
    await load();
    setTimeout(() => setMessage(null), 3000);
  };

  const applyRoomSelection = (roomId: string) => {
    if (!roomId) {
      setField('room_id', '');
      return;
    }
    const room = eventRooms.find((r) => r.id === roomId);
    if (!room) return;
    setForm((prev) => ({
      ...prev,
      room_id: roomId,
      salle_nom: room.nom,
      lien_live_zoom: prev.lien_live_zoom || room.visio_url || '',
      couleur: prev.couleur || room.couleur || '',
    }));
  };

  const openReminder = (session: AgendaSession) => {
    setReminderSession(session);
    setReminderAudience((session.abstracts_inclus?.length ?? 0) > 0 ? 'authors' : 'all');
    setReminderNote('');
    setMessage(null);
  };

  const sendSessionReminder = async () => {
    if (!reminderSession) return;
    const linkedAuthorIds = (reminderSession.abstracts_inclus ?? [])
      .map((id) => abstractsById.get(id)?.author_id ?? null)
      .filter(Boolean) as string[];
    setSendingReminder(true);
    const response = await fetch('/api/notify/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'session_reminder',
        audience: reminderAudience,
        link: '/dashboard/programme',
        variables: {
          nom_session: reminderSession.titre,
          date_session: reminderSession.date_session ?? 'date à confirmer',
          heure_session: formatTimeRange(reminderSession.heure_debut, reminderSession.heure_fin),
          nom_salle: reminderSession.salle_nom ?? reminderSession.room?.nom ?? 'salle à confirmer',
          message_special: reminderNote.trim(),
        },
        filters: {
          userIds: reminderAudience === 'authors' && linkedAuthorIds.length ? linkedAuthorIds : undefined,
        },
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
    setSendingReminder(false);
    if (!response.ok || !result?.ok) {
      setMessage({ type: 'error', text: result?.error || "Impossible d'envoyer le rappel de session." });
      return;
    }
    setMessage({
      type: 'success',
      text: `Rappel envoyé pour « ${reminderSession.titre} » à ${result.sent ?? 0} destinataire(s)${(result.failed ?? 0) > 0 ? `, ${result.failed} échec(s)` : ''}.`,
    });
    setReminderSession(null);
    setReminderNote('');
  };

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Programme &amp; Sessions</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '640px' }}>
            Composez le programme librement : conférences, ateliers, pauses, cérémonies, sessions orales…
            Tous les champs sont optionnels sauf le titre — organisez les journées, salles et intervenants comme vous le souhaitez.
          </p>
        </div>
        {!editingId && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={notifyProgramUpdated}
              disabled={notifyingProgram || sessions.length === 0}
              style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '11px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: sessions.length === 0 ? 'not-allowed' : 'pointer', opacity: sessions.length === 0 ? 0.6 : 1 }}
            >
              {notifyingProgram ? 'Envoi…' : 'Notifier : programme mis à jour'}
            </button>
            <button
              type="button"
              onClick={openNew}
              style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Nouvelle session
            </button>
          </div>
        )}
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
          background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {message.text}
        </div>
      )}

      {editingId && (
        <SessionForm
          form={form}
          isNew={editingId === 'new'}
          saving={saving}
          eventRooms={eventRooms}
          roomNames={roomNames}
          abstracts={abstracts}
          showAbstracts={showAbstracts}
          onToggleAbstracts={() => setShowAbstracts((v) => !v)}
          onField={setField}
          onRoomSelect={applyRoomSelection}
          onToggleAbstract={toggleAbstract}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement du programme…</p>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '46px', marginBottom: '10px' }}>📅</div>
          <p style={{ color: '#64748b', margin: '0 0 16px' }}>Aucune session pour le moment.</p>
          {!editingId && (
            <button type="button" onClick={openNew} style={{ background: '#1B6B2E', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Créer la première session
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {days.map((day) => (
            <div key={day.date ?? 'none'}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize', margin: '0 0 12px', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <span>{day.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>{day.sessions.length} session{day.sessions.length > 1 ? 's' : ''}</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {day.sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    abstractsById={abstractsById}
                    onEdit={() => openEdit(s)}
                    onDelete={() => handleDelete(s)}
                    onReminder={() => openReminder(s)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {reminderSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '720px', margin: '30px auto', background: '#fff', borderRadius: '18px', padding: '24px', boxShadow: '0 18px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '19px', color: '#0f172a' }}>Envoyer un rappel de session</h2>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
              Le modèle éditable `Rappel de session` sera utilisé pour « {reminderSession.titre} ».
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Audience</label>
                <select style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={reminderAudience} onChange={(e) => setReminderAudience(e.target.value as ReminderAudience)}>
                  <option value="all">Tous les utilisateurs</option>
                  <option value="participants">Participants</option>
                  <option value="authors">Auteurs</option>
                  <option value="evaluators">Évaluateurs</option>
                  <option value="organizers">Organisateurs / admins</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Horaire rappelé</label>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                  {formatTimeRange(reminderSession.heure_debut, reminderSession.heure_fin)}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Note complémentaire</label>
                <textarea style={{ width: '100%', minHeight: '100px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} placeholder="Ex : merci d’arriver 15 minutes avant le début de la session." />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => setReminderSession(null)} style={{ background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={sendSessionReminder} disabled={sendingReminder} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                {sendingReminder ? 'Envoi…' : 'Envoyer le rappel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SessionCard({
  session,
  abstractsById,
  onEdit,
  onDelete,
  onReminder,
}: {
  session: AgendaSession;
  abstractsById: Map<string, AcceptedAbstract>;
  onEdit: () => void;
  onDelete: () => void;
  onReminder: () => void;
}) {
  const accent = session.couleur || '#cbd5e1';
  const linked = (session.abstracts_inclus ?? []).map((id) => abstractsById.get(id)).filter(Boolean) as AcceptedAbstract[];

  return (
    <div style={{ display: 'flex', gap: '14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ width: '5px', background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 16px 14px 4px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>🕒 {formatTimeRange(session.heure_debut, session.heure_fin)}</span>
              {session.type_session && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '3px 9px', borderRadius: '10px' }}>{session.type_session}</span>
              )}
              {session.salle_nom && (
                <span style={{ fontSize: '12px', color: '#64748b' }}>📍 {session.salle_nom}</span>
              )}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>{session.titre}</h3>
            {session.intervenants && (
              <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0' }}>👤 {session.intervenants}</p>
            )}
            {session.description && (
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>{session.description}</p>
            )}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px' }}>
              {(() => {
                const visioUrl = resolveSessionVisioUrl(session);
                const provider = resolveSessionVisioProvider(session);
                if (!visioUrl) return null;
                return (
                  <a href={visioUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#1B6B2E', fontWeight: 600, textDecoration: 'none' }}>
                    {visioProviderIcon(provider)} {provider ? VISIO_PROVIDER_LABELS[provider] : 'Visio'} — lien
                  </a>
                );
              })()}
              {linked.length > 0 && (
                <span style={{ fontSize: '12px', color: '#C9A010', fontWeight: 600 }}>
                  📄 {linked.length} résumé{linked.length > 1 ? 's' : ''} présenté{linked.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {linked.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: '#64748b', fontSize: '12px' }}>
                {linked.map((a) => (
                  <li key={a.id}>{a.titre}</li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button type="button" onClick={onReminder} style={{ background: '#E8F5EC', color: '#145224', border: '1px solid #B7DFC0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Rappel</button>
            <button type="button" onClick={onEdit} style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Modifier</button>
            <button type="button" onClick={onDelete} style={{ background: 'transparent', color: '#b91c1c', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SessionForm({
  form,
  isNew,
  saving,
  eventRooms,
  roomNames,
  abstracts,
  showAbstracts,
  onToggleAbstracts,
  onField,
  onRoomSelect,
  onToggleAbstract,
  onSave,
  onCancel,
}: {
  form: FormState;
  isNew: boolean;
  saving: boolean;
  eventRooms: EventRoom[];
  roomNames: string[];
  abstracts: AcceptedAbstract[];
  showAbstracts: boolean;
  onToggleAbstracts: () => void;
  onField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onRoomSelect: (roomId: string) => void;
  onToggleAbstract: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const label: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };
  const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' };

  return (
    <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 18px' }}>
        {isNew ? 'Nouvelle session' : 'Modifier la session'}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Titre *</label>
          <input style={input} value={form.titre} onChange={(e) => onField('titre', e.target.value)} placeholder="Ex : Conférence d'ouverture — Nutrition et santé publique" />
        </div>

        <div>
          <label style={label}>Type de session</label>
          <input style={input} list="session-types" value={form.type_session ?? ''} onChange={(e) => onField('type_session', e.target.value)} placeholder="Conférence, Atelier, Pause…" />
          <datalist id="session-types">
            {SESSION_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>

        <div>
          <label style={label}>Salle enregistrée</label>
          <select
            style={input}
            value={form.room_id ?? ''}
            onChange={(e) => onRoomSelect(e.target.value)}
          >
            <option value="">— Choisir une salle (ou saisir manuellement) —</option>
            {eventRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.nom} ({r.type})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={label}>Nom affiché (salle / lieu)</label>
          <input style={input} list="session-rooms" value={form.salle_nom ?? ''} onChange={(e) => onField('salle_nom', e.target.value)} placeholder="Amphi A, Salle virtuelle 1…" />
          <datalist id="session-rooms">
            {roomNames.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>

        <div>
          <label style={label}>Date</label>
          <input style={input} type="date" value={form.date_session ?? ''} onChange={(e) => onField('date_session', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Début</label>
            <input style={input} type="time" value={form.heure_debut ?? ''} onChange={(e) => onField('heure_debut', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Fin</label>
            <input style={input} type="time" value={form.heure_fin ?? ''} onChange={(e) => onField('heure_fin', e.target.value)} />
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Intervenant(s)</label>
          <input style={input} value={form.intervenants ?? ''} onChange={(e) => onField('intervenants', e.target.value)} placeholder="Pr. Jean Dupont (Université d'Abomey-Calavi), Dr. …" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Lien visioconférence (optionnel — prioritaire sur le lien de la salle)</label>
          <input style={input} type="url" value={form.lien_live_zoom ?? ''} onChange={(e) => onField('lien_live_zoom', e.target.value)} placeholder="Zoom, Google Meet, Teams, Jitsi…" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Description</label>
          <textarea style={{ ...input, resize: 'vertical', minHeight: '70px' }} value={form.description ?? ''} onChange={(e) => onField('description', e.target.value)} placeholder="Programme détaillé, objectifs, remarques…" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Couleur de repérage</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {SESSION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onField('couleur', c)}
                aria-label={`Couleur ${c}`}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer',
                  border: form.couleur === c ? '3px solid #0f172a' : '2px solid #fff', boxShadow: '0 0 0 1px #e2e8f0',
                }}
              />
            ))}
            <button type="button" onClick={() => onField('couleur', '')} style={{ fontSize: '12px', color: '#64748b', background: 'transparent', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' }}>
              Aucune
            </button>
          </div>
        </div>
      </div>

      {/* Résumés présentés */}
      <div style={{ marginTop: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
        <button type="button" onClick={onToggleAbstracts} style={{ background: 'transparent', border: 'none', color: '#1B6B2E', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}>
          {showAbstracts ? '▾' : '▸'} Rattacher des résumés acceptés ({form.abstracts_inclus.length} sélectionné{form.abstracts_inclus.length > 1 ? 's' : ''})
        </button>
        {showAbstracts && (
          <div style={{ marginTop: '12px', maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
            {abstracts.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px' }}>Aucun résumé accepté pour l&apos;instant.</p>
            ) : (
              abstracts.map((a) => (
                <label key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={form.abstracts_inclus.includes(a.id)} onChange={() => onToggleAbstract(a.id)} style={{ marginTop: '3px' }} />
                  <span style={{ color: '#334155' }}>
                    {a.titre}
                    {a.thematique && <span style={{ color: '#94a3b8' }}> — {a.thematique}</span>}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
        <button type="button" onClick={onCancel} disabled={saving} style={{ background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          Annuler
        </button>
        <button type="button" onClick={onSave} disabled={saving} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement…' : isNew ? 'Ajouter la session' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
