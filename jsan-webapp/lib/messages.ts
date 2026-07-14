import type { SupabaseClient } from '@supabase/supabase-js';

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  abstract_id: string | null;
  contenu: string;
  is_read: boolean;
  created_at: string;
  sender?: { id: string; prenom: string | null; nom: string | null; role: string };
  receiver?: { id: string; prenom: string | null; nom: string | null; role: string };
  abstracts?: { id: string; titre: string } | null;
}

type MessageProfile = NonNullable<MessageRow['sender']>;

export interface MessageThread {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserHandle: string;
  otherUserRole: string;
  otherUserPrenom: string | null;
  otherUserNom: string | null;
  abstractId: string | null;
  abstractTitle: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  messages: MessageRow[];
}

const MESSAGE_SELECT = `
  id, sender_id, receiver_id, abstract_id, contenu, is_read, created_at,
  sender:users_profile!messages_sender_id_fkey (id, prenom, nom, role),
  receiver:users_profile!messages_receiver_id_fkey (id, prenom, nom, role),
  abstracts (id, titre)
`;

export function formatUserName(prenom: string | null | undefined, nom: string | null | undefined): string {
  const full = `${prenom ?? ''} ${nom ?? ''}`.trim();
  return full || 'Utilisateur';
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatMessageTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (msgDay.getTime() === today.getTime()) return `Aujourd'hui, ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay.getTime() === yesterday.getTime()) return `Hier, ${time}`;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function userHandle(
  prenom: string | null | undefined,
  nom: string | null | undefined,
  role?: string | null
): string {
  if (role === 'organisateur' || role === 'superadmin' || role === 'admin') return '@org_jsan';
  if (role === 'pair_valide' || role === 'pair_en_attente') {
    const p = (prenom ?? '').toLowerCase().replace(/[^a-z]/g, '');
    const n = (nom ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (p && n) return `@${p.charAt(0)}${n}`;
    return '@evaluateur';
  }
  const p = (prenom ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const n = (nom ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (p && n) return `@${p}${n.charAt(0)}`;
  return '@auteur';
}

export function threadDisplayName(
  prenom: string | null | undefined,
  nom: string | null | undefined,
  role?: string | null
): string {
  if (role === 'organisateur' || role === 'superadmin' || role === 'admin') return 'Comité JSAN';
  return formatUserName(prenom, nom);
}

export function avatarUrl(prenom: string | null | undefined, nom: string | null | undefined, size = 96): string {
  const name = formatUserName(prenom, nom);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;
}

export async function getStaffContactId(supabase: SupabaseClient): Promise<string | null> {
  const profile = await getStaffContactProfile(supabase);
  return profile?.id ?? null;
}

export interface StaffContactProfile {
  id: string;
  prenom: string | null;
  nom: string | null;
  role: string;
}

export async function getStaffContactProfile(
  supabase: SupabaseClient,
  excludeUserId?: string | null
): Promise<StaffContactProfile | null> {
  // 1) Contact explicitement choisi dans Paramètres → Comité
  try {
    const { getCommitteeMessagingContact } = await import('@/lib/committee');
    const fromCommittee = await getCommitteeMessagingContact(supabase, excludeUserId);
    if (fromCommittee) return fromCommittee;
  } catch {
    /* table absente tant que migration 035 non appliquée */
  }

  // 2) Repli : premier compte staff
  const { data } = await supabase
    .from('users_profile')
    .select('id, prenom, nom, role')
    .in('role', ['organisateur', 'superadmin', 'admin'])
    .order('created_at', { ascending: true })
    .limit(5);

  const rows = (data ?? []) as StaffContactProfile[];
  if (excludeUserId) {
    return rows.find((row) => row.id !== excludeUserId) ?? null;
  }
  return rows[0] ?? null;
}

/** Brouillon local pour démarrer une conversation sans message encore en base. */
export function createDraftThread(profile: StaffContactProfile): MessageThread {
  return {
    id: profile.id,
    otherUserId: profile.id,
    otherUserName: threadDisplayName(profile.prenom, profile.nom, profile.role),
    otherUserHandle: userHandle(profile.prenom, profile.nom, profile.role),
    otherUserRole: profile.role,
    otherUserPrenom: profile.prenom,
    otherUserNom: profile.nom,
    abstractId: null,
    abstractTitle: null,
    lastMessage: 'Nouvelle conversation',
    lastMessageAt: new Date().toISOString(),
    unread: false,
    messages: [],
  };
}

export function staffContactDisplayName(profile: StaffContactProfile | null): string {
  if (!profile) return 'Secrétariat JSAN';
  const name = formatUserName(profile.prenom, profile.nom);
  return name !== 'Utilisateur' ? name : 'Secrétariat JSAN';
}

export function buildThreadId(otherUserId: string, abstractId: string | null): string {
  return `${otherUserId}::${abstractId ?? 'general'}`;
}

function takeFirstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function buildThreadFromProfile(
  otherId: string,
  otherProfile: MessageProfile | undefined,
  msg: MessageRow
): MessageThread {
  const role = otherProfile?.role ?? 'organisateur';
  return {
    id: otherId,
    otherUserId: otherId,
    otherUserName: threadDisplayName(otherProfile?.prenom, otherProfile?.nom, role),
    otherUserHandle: userHandle(otherProfile?.prenom, otherProfile?.nom, role),
    otherUserRole: role,
    otherUserPrenom: otherProfile?.prenom ?? null,
    otherUserNom: otherProfile?.nom ?? null,
    abstractId: msg.abstract_id,
    abstractTitle: msg.abstracts?.titre ?? null,
    lastMessage: msg.contenu,
    lastMessageAt: msg.created_at,
    unread: false,
    messages: [],
  };
}

/** Regroupe par contact (une ligne par interlocuteur), comme la maquette. */
export function groupMessagesIntoThreads(messages: MessageRow[], currentUserId: string): MessageThread[] {
  const map = new Map<string, MessageThread>();

  for (const msg of messages) {
    const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
    if (!otherId) continue;

    const otherProfile = msg.sender_id === currentUserId ? msg.receiver : msg.sender;

    if (!map.has(otherId)) {
      map.set(otherId, buildThreadFromProfile(otherId, otherProfile, msg));
    }

    const thread = map.get(otherId)!;
    thread.messages.push(msg);
    if (new Date(msg.created_at) >= new Date(thread.lastMessageAt)) {
      thread.lastMessage = msg.contenu;
      thread.lastMessageAt = msg.created_at;
      thread.abstractId = msg.abstract_id;
      thread.abstractTitle = msg.abstracts?.titre ?? null;
    }
    if (msg.receiver_id === currentUserId && !msg.is_read) {
      thread.unread = true;
    }
  }

  return Array.from(map.values())
    .map((t) => ({ ...t, messages: t.messages.sort((a, b) => a.created_at.localeCompare(b.created_at)) }))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function fetchUserMessages(supabase: SupabaseClient, userId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const typed = row as MessageRow & {
      sender?: MessageProfile[];
      receiver?: MessageProfile[];
      abstracts?: { id: string; titre: string }[];
    };

    return {
      ...typed,
      sender: takeFirstRelation(typed.sender),
      receiver: takeFirstRelation(typed.receiver),
      abstracts: takeFirstRelation(typed.abstracts) ?? null,
    };
  });
}

export async function sendMessage(
  supabase: SupabaseClient,
  payload: { sender_id: string; receiver_id: string; abstract_id?: string | null; contenu: string }
): Promise<string | null> {
  const { error } = await supabase.from('messages').insert({
    sender_id: payload.sender_id,
    receiver_id: payload.receiver_id,
    abstract_id: payload.abstract_id ?? null,
    contenu: payload.contenu.trim(),
  });
  return error?.message ?? null;
}

export async function markThreadAsRead(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string,
  _abstractId?: string | null
): Promise<void> {
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', otherUserId)
    .eq('is_read', false);
}
