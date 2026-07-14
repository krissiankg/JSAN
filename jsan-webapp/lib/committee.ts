import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffContactProfile } from '@/lib/messages';

export type CommitteeSection = 'bureau' | 'commission' | 'ressource';

export interface CommitteeMember {
  id: string;
  section: CommitteeSection;
  commission: string | null;
  title: string;
  full_name: string;
  user_id: string | null;
  is_messaging_contact: boolean;
  ordre: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    role: string;
    email?: string | null;
  } | null;
}

export interface CommitteeMemberInput {
  section: CommitteeSection;
  commission?: string | null;
  title: string;
  full_name: string;
  user_id?: string | null;
  is_messaging_contact?: boolean;
  ordre?: number;
  is_active?: boolean;
}

export const COMMITTEE_SECTION_LABELS: Record<CommitteeSection, string> = {
  bureau: 'Bureau du comité',
  commission: 'Commissions techniques',
  ressource: 'Personnes ressources',
};

export const DEFAULT_COMMISSIONS = [
  'Gestion scientifique',
  'Secrétariat',
  'Communication et Marketing',
  'Mobilisation des ressources',
  'Logistique',
  'Finance',
] as const;

const MEMBER_SELECT_BASE = `
  id, section, commission, title, full_name, user_id,
  is_messaging_contact, ordre, is_active, created_at, updated_at
`;

const MEMBER_SELECT_WITH_USER = `
  ${MEMBER_SELECT_BASE},
  user:users_profile!user_id (id, prenom, nom, role)
`;

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeMember(row: Record<string, unknown>): CommitteeMember {
  return {
    id: String(row.id),
    section: row.section as CommitteeSection,
    commission: (row.commission as string | null) ?? null,
    title: String(row.title),
    full_name: String(row.full_name),
    user_id: (row.user_id as string | null) ?? null,
    is_messaging_contact: Boolean(row.is_messaging_contact),
    ordre: Number(row.ordre ?? 0),
    is_active: row.is_active !== false,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    user: takeFirst(row.user as CommitteeMember['user'] | CommitteeMember['user'][] | null),
  };
}

export async function fetchCommitteeMembers(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean; includeInactive?: boolean }
): Promise<CommitteeMember[]> {
  const run = async (select: string) => {
    let query = supabase
      .from('committee_members')
      .select(select)
      .order('section', { ascending: true })
      .order('ordre', { ascending: true })
      .order('full_name', { ascending: true });

    if (options?.activeOnly || !options?.includeInactive) {
      query = query.eq('is_active', true);
    }
    return query;
  };

  // Essai avec jointure profil ; repli sans jointure si relation absente
  let { data, error } = await run(MEMBER_SELECT_WITH_USER);

  if (error) {
    const fallback = await run(MEMBER_SELECT_BASE);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeMember(row as Record<string, unknown>));
}

export function groupCommitteeMembers(members: CommitteeMember[]) {
  const bureau = members.filter((m) => m.section === 'bureau');
  const ressources = members.filter((m) => m.section === 'ressource');
  const commissionsMap = new Map<string, CommitteeMember[]>();
  for (const m of members.filter((x) => x.section === 'commission')) {
    const key = m.commission ?? 'Autre';
    if (!commissionsMap.has(key)) commissionsMap.set(key, []);
    commissionsMap.get(key)!.push(m);
  }
  const commissions = Array.from(commissionsMap.entries()).map(([name, items]) => ({
    name,
    members: items,
  }));
  return { bureau, ressources, commissions };
}

export async function createCommitteeMember(
  supabase: SupabaseClient,
  input: CommitteeMemberInput
): Promise<string | null> {
  if (input.is_messaging_contact) {
    await clearMessagingContacts(supabase);
  }
  const { error } = await supabase.from('committee_members').insert({
    section: input.section,
    commission: input.section === 'commission' ? (input.commission ?? null) : null,
    title: input.title.trim(),
    full_name: input.full_name.trim(),
    user_id: input.user_id ?? null,
    is_messaging_contact: Boolean(input.is_messaging_contact),
    ordre: input.ordre ?? 0,
    is_active: input.is_active ?? true,
  });
  return error?.message ?? null;
}

export async function updateCommitteeMember(
  supabase: SupabaseClient,
  id: string,
  input: Partial<CommitteeMemberInput>
): Promise<string | null> {
  if (input.is_messaging_contact) {
    await clearMessagingContacts(supabase, id);
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.section !== undefined) payload.section = input.section;
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
  if (input.user_id !== undefined) payload.user_id = input.user_id;
  if (input.is_messaging_contact !== undefined) payload.is_messaging_contact = input.is_messaging_contact;
  if (input.ordre !== undefined) payload.ordre = input.ordre;
  if (input.is_active !== undefined) payload.is_active = input.is_active;

  if (input.section === 'commission') {
    payload.commission = input.commission ?? null;
  } else if (input.section !== undefined) {
    payload.commission = null;
  } else if (input.commission !== undefined) {
    payload.commission = input.commission;
  }

  const { error } = await supabase.from('committee_members').update(payload).eq('id', id);
  return error?.message ?? null;
}

export async function deleteCommitteeMember(
  supabase: SupabaseClient,
  id: string
): Promise<string | null> {
  const { error } = await supabase.from('committee_members').delete().eq('id', id);
  return error?.message ?? null;
}

async function clearMessagingContacts(supabase: SupabaseClient, exceptId?: string) {
  let query = supabase
    .from('committee_members')
    .update({ is_messaging_contact: false, updated_at: new Date().toISOString() })
    .eq('is_messaging_contact', true);
  if (exceptId) query = query.neq('id', exceptId);
  await query;
}

/** Contact messagerie = membre marqué « contact secrétariat » lié à un compte. */
export async function getCommitteeMessagingContact(
  supabase: SupabaseClient,
  excludeUserId?: string | null
): Promise<StaffContactProfile | null> {
  const { data, error } = await supabase
    .from('committee_members')
    .select(`
      id, full_name, user_id,
      user:users_profile!user_id (id, prenom, nom, role)
    `)
    .eq('is_messaging_contact', true)
    .eq('is_active', true)
    .not('user_id', 'is', null)
    .limit(3);

  if (error || !data?.length) return null;

  for (const row of data) {
    const user = takeFirst(row.user as StaffContactProfile | StaffContactProfile[] | null);
    if (!user) continue;
    if (excludeUserId && user.id === excludeUserId) continue;
    return {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      role: user.role,
    };
  }
  return null;
}

export async function searchPlatformUsers(
  supabase: SupabaseClient,
  query: string,
  limit = 12
): Promise<Array<{ id: string; prenom: string | null; nom: string | null; role: string }>> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from('users_profile')
    .select('id, prenom, nom, role')
    .or(`prenom.ilike.%${q}%,nom.ilike.%${q}%`)
    .limit(limit);

  if (error) return [];
  return data ?? [];
}
