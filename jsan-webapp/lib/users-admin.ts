import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbUserRole } from '@/lib/roles';
import { mapDbRoleToAppRole } from '@/lib/roles';

export interface StaffUserRow {
  id: string;
  nom: string | null;
  prenom: string | null;
  role: DbUserRole;
  is_student_verified: boolean;
  is_member_verified: boolean;
  created_at: string;
  telephone: string | null;
}

export function dbRoleToSelectValue(role: DbUserRole): string {
  switch (role) {
    case 'pair_en_attente':
      return 'pair_pending';
    case 'pair_valide':
      return 'pair_valid';
    case 'admin':
    case 'superadmin':
      return 'superadmin';
    default:
      return role;
  }
}

export function selectValueToDbRole(value: string, _currentRole: DbUserRole): DbUserRole {
  switch (value) {
    case 'participant':
      return 'participant';
    case 'auteur':
      return 'auteur';
    case 'pair_pending':
      return 'pair_en_attente';
    case 'pair_valid':
      return 'pair_valide';
    case 'organisateur':
      return 'organisateur';
    case 'superadmin':
      return 'superadmin';
    default:
      return 'participant';
  }
}

export function getJustificatifStatusLabel(user: StaffUserRow): { label: string; tone: 'approved' | 'pending' | 'neutral' } {
  if (user.is_student_verified || user.is_member_verified) {
    return { label: '↑ Validé', tone: 'approved' };
  }
  return { label: '—', tone: 'neutral' };
}

export async function fetchAllUsersForStaff(supabase: SupabaseClient): Promise<StaffUserRow[]> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, nom, prenom, role, is_student_verified, is_member_verified, created_at, telephone')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffUserRow[];
}

export async function updateUserRole(
  supabase: SupabaseClient,
  userId: string,
  newRole: DbUserRole
): Promise<string | null> {
  const { error } = await supabase.from('users_profile').update({ role: newRole }).eq('id', userId);
  return error?.message ?? null;
}

export function formatUserDisplayName(user: Pick<StaffUserRow, 'prenom' | 'nom'>): string {
  return [user.prenom, user.nom].filter(Boolean).join(' ') || 'Utilisateur';
}

export function formatRegistrationDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getRoleLabelFromDb(role: DbUserRole): string {
  return mapDbRoleToAppRole(role) === 'pair'
    ? role === 'pair_valide'
      ? 'Évaluateur'
      : 'Évaluateur (en attente)'
    : mapDbRoleToAppRole(role) === 'superadmin'
      ? 'Super Admin'
      : mapDbRoleToAppRole(role) === 'organisateur'
        ? 'Organisateur'
        : mapDbRoleToAppRole(role) === 'auteur'
          ? 'Auteur'
          : 'Participant';
}
