import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgendaSession } from '@/lib/agenda';

export type RoomType = 'physique' | 'virtuelle' | 'hybride';
export type VisioProvider = 'zoom' | 'meet' | 'teams' | 'jitsi' | 'autre';

export interface EventRoom {
  id: string;
  nom: string;
  type: RoomType;
  capacite: number | null;
  lieu: string | null;
  visio_provider: VisioProvider | null;
  visio_url: string | null;
  notes: string | null;
  couleur: string | null;
  ordre: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface EventRoomInput {
  nom: string;
  type: RoomType;
  capacite?: number | null;
  lieu?: string | null;
  visio_provider?: VisioProvider | null;
  visio_url?: string | null;
  notes?: string | null;
  couleur?: string | null;
  ordre?: number | null;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  physique: 'Physique',
  virtuelle: 'Virtuelle',
  hybride: 'Hybride',
};

export const VISIO_PROVIDER_LABELS: Record<VisioProvider, string> = {
  zoom: 'Zoom',
  meet: 'Google Meet',
  teams: 'Microsoft Teams',
  jitsi: 'Jitsi',
  autre: 'Autre',
};

export const ROOM_COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#64748b',
];

export const ROOM_SELECT =
  'id, nom, type, capacite, lieu, visio_provider, visio_url, notes, couleur, ordre, created_at, updated_at';

export async function fetchEventRooms(supabase: SupabaseClient): Promise<EventRoom[]> {
  const { data } = await supabase
    .from('event_rooms')
    .select(ROOM_SELECT)
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });
  return (data ?? []) as EventRoom[];
}

function normalizeRoom(input: EventRoomInput): Record<string, unknown> {
  const clean = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };
  return {
    nom: input.nom.trim(),
    type: input.type,
    capacite: input.capacite ?? null,
    lieu: clean(input.lieu),
    visio_provider: input.visio_provider ?? null,
    visio_url: clean(input.visio_url),
    notes: clean(input.notes),
    couleur: clean(input.couleur),
    ordre: input.ordre ?? 0,
  };
}

export async function createEventRoom(
  supabase: SupabaseClient,
  input: EventRoomInput
): Promise<string | null> {
  if (!input.nom.trim()) return 'Le nom de la salle est obligatoire.';
  const { error } = await supabase.from('event_rooms').insert(normalizeRoom(input));
  return error ? error.message : null;
}

export async function updateEventRoom(
  supabase: SupabaseClient,
  id: string,
  input: EventRoomInput
): Promise<string | null> {
  if (!input.nom.trim()) return 'Le nom de la salle est obligatoire.';
  const { error } = await supabase
    .from('event_rooms')
    .update({ ...normalizeRoom(input), updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteEventRoom(
  supabase: SupabaseClient,
  id: string
): Promise<string | null> {
  const { error } = await supabase.from('event_rooms').delete().eq('id', id);
  return error ? error.message : null;
}

/** Détecte le fournisseur visio à partir d'une URL (pour icônes / libellés). */
export function detectVisioProvider(url: string | null | undefined): VisioProvider | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('zoom.us') || u.includes('zoom.com')) return 'zoom';
  if (u.includes('meet.google') || u.includes('google.com/meet')) return 'meet';
  if (u.includes('teams.microsoft') || u.includes('teams.live.com')) return 'teams';
  if (u.includes('jitsi') || u.includes('meet.jit.si')) return 'jitsi';
  return 'autre';
}

export function visioProviderIcon(provider: VisioProvider | null): string {
  switch (provider) {
    case 'zoom': return '📹';
    case 'meet': return '🟢';
    case 'teams': return '🟦';
    case 'jitsi': return '🎥';
    case 'autre': return '🔗';
    default: return '💻';
  }
}

/** Lien effectif : priorité au lien spécifique de la session, sinon celui de la salle. */
export function resolveSessionVisioUrl(
  session: Pick<AgendaSession, 'lien_live_zoom'> & { room?: Pick<EventRoom, 'visio_url'> | null }
): string | null {
  const sessionLink = session.lien_live_zoom?.trim();
  if (sessionLink) return sessionLink;
  const roomLink = session.room?.visio_url?.trim();
  return roomLink || null;
}

export function resolveSessionVisioProvider(
  session: Pick<AgendaSession, 'lien_live_zoom'> & { room?: Pick<EventRoom, 'visio_provider' | 'visio_url'> | null }
): VisioProvider | null {
  if (session.lien_live_zoom?.trim()) {
    return detectVisioProvider(session.lien_live_zoom) ?? session.room?.visio_provider ?? null;
  }
  if (session.room?.visio_provider) return session.room.visio_provider;
  return detectVisioProvider(session.room?.visio_url);
}

// --- Créneaux parallèles (même jour, horaires qui se chevauchent) ------------

function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function sessionsOverlap(a: AgendaSession, b: AgendaSession): boolean {
  if (!a.date_session || !b.date_session || a.date_session !== b.date_session) return false;
  const aStart = timeToMinutes(a.heure_debut);
  const bStart = timeToMinutes(b.heure_debut);
  if (aStart == null || bStart == null) return false;
  const aEnd = timeToMinutes(a.heure_fin) ?? aStart + 60;
  const bEnd = timeToMinutes(b.heure_fin) ?? bStart + 60;
  return aStart < bEnd && bStart < aEnd;
}

export interface ParallelSlot {
  date: string;
  dateLabel: string;
  sessions: AgendaSession[];
}

/** Regroupe les sessions qui se chevauchent sur un même jour (sessions parallèles). */
export function findParallelSlots(sessions: AgendaSession[]): ParallelSlot[] {
  const dated = sessions.filter((s) => s.date_session && s.heure_debut);
  const slots: ParallelSlot[] = [];
  const used = new Set<string>();

  for (let i = 0; i < dated.length; i++) {
    if (used.has(dated[i].id)) continue;
    const group = [dated[i]];
    used.add(dated[i].id);
    for (let j = i + 1; j < dated.length; j++) {
      if (used.has(dated[j].id)) continue;
      if (group.some((g) => sessionsOverlap(g, dated[j]))) {
        group.push(dated[j]);
        used.add(dated[j].id);
      }
    }
    if (group.length > 1) {
      group.sort((a, b) => (timeToMinutes(a.heure_debut) ?? 0) - (timeToMinutes(b.heure_debut) ?? 0));
      slots.push({
        date: group[0].date_session!,
        dateLabel: new Date(`${group[0].date_session}T00:00:00`).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long',
        }),
        sessions: group,
      });
    }
  }

  return slots.sort((a, b) => a.date.localeCompare(b.date));
}
