import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbUserRole } from '@/lib/roles';
import { notifyEvaluatorApproved } from '@/lib/notifications';

export interface EvaluatorRow {
  id: string;
  prenom: string | null;
  nom: string | null;
  role: DbUserRole;
  specialite: string | null;
  institution: string | null;
  telephone: string | null;
  created_at: string;
}

export function formatEvaluatorName(row: Pick<EvaluatorRow, 'prenom' | 'nom'>): string {
  return [row.prenom, row.nom].filter(Boolean).join(' ') || 'Évaluateur';
}

export function evaluatorStatusLabel(role: DbUserRole): { label: string; bg: string; color: string } {
  if (role === 'pair_valide') {
    return { label: 'Validé', bg: '#dcfce7', color: '#166534' };
  }
  return { label: 'En attente', bg: '#fef3c7', color: '#b45309' };
}

export async function fetchEvaluators(supabase: SupabaseClient): Promise<EvaluatorRow[]> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, prenom, nom, role, specialite, institution, telephone, created_at')
    .in('role', ['pair_en_attente', 'pair_valide'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluatorRow[];
}

export async function setEvaluatorStatus(
  supabase: SupabaseClient,
  userId: string,
  approved: boolean
): Promise<string | null> {
  const newRole: DbUserRole = approved ? 'pair_valide' : 'pair_en_attente';
  const { error } = await supabase
    .from('users_profile')
    .update({ role: newRole })
    .eq('id', userId)
    .in('role', ['pair_en_attente', 'pair_valide']);

  if (error) return error.message;

  if (approved) {
    await notifyEvaluatorApproved(supabase, userId);
  }

  return null;
}
