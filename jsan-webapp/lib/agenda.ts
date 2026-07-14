import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventRoom } from '@/lib/rooms';

// Programme & Sessions — modèle volontairement souple : presque tous les champs
// sont optionnels pour laisser l'équipe composer le programme librement
// (conférences, ateliers, pauses, cérémonies, sessions orales de résumés…).

export interface AgendaSession {
  id: string;
  titre: string;
  description: string | null;
  date_session: string | null; // YYYY-MM-DD
  heure_debut: string | null; // HH:MM[:SS]
  heure_fin: string | null;
  salle_nom: string | null;
  room_id: string | null;
  lien_live_zoom: string | null;
  room?: Pick<EventRoom, 'id' | 'nom' | 'type' | 'visio_provider' | 'visio_url' | 'lieu' | 'couleur'> | null;
  abstracts_inclus: string[] | null;
  type_session: string | null;
  intervenants: string | null;
  couleur: string | null;
  ordre: number | null;
  created_at: string;
  updated_at: string | null;
}

/** Données modifiables d'une session (formulaire). */
export interface AgendaSessionInput {
  titre: string;
  description?: string | null;
  date_session?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  salle_nom?: string | null;
  room_id?: string | null;
  lien_live_zoom?: string | null;
  abstracts_inclus?: string[] | null;
  type_session?: string | null;
  intervenants?: string | null;
  couleur?: string | null;
  ordre?: number | null;
}

/** Suggestions de types (l'équipe peut aussi saisir le sien). */
export const SESSION_TYPE_SUGGESTIONS = [
  'Conférence plénière',
  'Session orale',
  'Atelier',
  'Table ronde',
  'Symposium',
  'Session poster',
  'Cérémonie',
  'Pause',
  'Déjeuner',
  'Networking',
  'Autre',
];

/** Palette de couleurs de repérage proposée (repérage visuel des sessions). */
export const SESSION_COLORS = [
  '#1B6B2E', '#10b981', '#f59e0b', '#3D8A4F',
  '#ef4444', '#06b6d4', '#ec4899', '#64748b',
];

export const AGENDA_SELECT =
  'id, titre, description, date_session, heure_debut, heure_fin, salle_nom, room_id, lien_live_zoom, abstracts_inclus, type_session, intervenants, couleur, ordre, created_at, updated_at, room:room_id(id, nom, type, visio_provider, visio_url, lieu, couleur)';

export async function fetchAgendaSessions(
  supabase: SupabaseClient
): Promise<AgendaSession[]> {
  const { data } = await supabase
    .from('agenda_sessions')
    .select(AGENDA_SELECT)
    .order('date_session', { ascending: true, nullsFirst: false })
    .order('heure_debut', { ascending: true, nullsFirst: true })
    .order('ordre', { ascending: true });

  return (data ?? []).map((row) => {
    const r = row as AgendaSession & { room?: AgendaSession['room'] | AgendaSession['room'][] };
    const room = Array.isArray(r.room) ? r.room[0] ?? null : r.room ?? null;
    return { ...r, room };
  });
}

/** Résumés acceptés proposés au rattachement à une session orale. */
export interface AcceptedAbstract {
  id: string;
  author_id?: string | null;
  titre: string;
  thematique: string | null;
}

export async function fetchAcceptedAbstracts(
  supabase: SupabaseClient
): Promise<AcceptedAbstract[]> {
  const { data } = await supabase
    .from('abstracts')
    .select('id, author_id, titre, thematique')
    .eq('statut', 'Accepte')
    .order('titre', { ascending: true });
  return (data ?? []) as AcceptedAbstract[];
}

function normalize(input: AgendaSessionInput): Record<string, unknown> {
  const clean = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };
  return {
    titre: input.titre.trim(),
    description: clean(input.description),
    date_session: clean(input.date_session),
    heure_debut: clean(input.heure_debut),
    heure_fin: clean(input.heure_fin),
    salle_nom: clean(input.salle_nom),
    room_id: input.room_id?.trim() || null,
    lien_live_zoom: clean(input.lien_live_zoom),
    abstracts_inclus: input.abstracts_inclus && input.abstracts_inclus.length ? input.abstracts_inclus : null,
    type_session: clean(input.type_session),
    intervenants: clean(input.intervenants),
    couleur: clean(input.couleur),
    ordre: input.ordre ?? 0,
  };
}

export async function createAgendaSession(
  supabase: SupabaseClient,
  input: AgendaSessionInput
): Promise<string | null> {
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  const { error } = await supabase.from('agenda_sessions').insert(normalize(input));
  return error ? error.message : null;
}

export async function updateAgendaSession(
  supabase: SupabaseClient,
  id: string,
  input: AgendaSessionInput
): Promise<string | null> {
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  const { error } = await supabase
    .from('agenda_sessions')
    .update({ ...normalize(input), updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteAgendaSession(
  supabase: SupabaseClient,
  id: string
): Promise<string | null> {
  const { error } = await supabase.from('agenda_sessions').delete().eq('id', id);
  return error ? error.message : null;
}

// --- Helpers d'affichage ----------------------------------------------------

export interface AgendaDay {
  date: string | null; // null = sessions sans date encore planifiée
  label: string;
  sessions: AgendaSession[];
}

/** Regroupe les sessions par jour (les non-datées en dernier). */
export function groupSessionsByDay(sessions: AgendaSession[]): AgendaDay[] {
  const map = new Map<string, AgendaSession[]>();
  for (const s of sessions) {
    const key = s.date_session ?? '__none__';
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }

  const days: AgendaDay[] = [];
  for (const [key, list] of map.entries()) {
    days.push({
      date: key === '__none__' ? null : key,
      label: key === '__none__' ? 'À planifier' : formatDayLabel(key),
      sessions: list,
    });
  }

  days.sort((a, b) => {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });
  return days;
}

export function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTimeRange(start: string | null, end: string | null): string {
  const fmt = (t: string | null) => (t ? t.slice(0, 5) : null);
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `dès ${s}`;
  if (e) return `jusqu'à ${e}`;
  return 'Horaire libre';
}
