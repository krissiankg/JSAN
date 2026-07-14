import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbUserRole } from '@/lib/roles';
import { notifyEvaluatorApproved, notifyEvaluatorRejected } from '@/lib/notifications';

export interface EvaluatorRow {
  id: string;
  prenom: string | null;
  nom: string | null;
  email?: string | null;
  role: DbUserRole;
  specialite: string | null;
  institution: string | null;
  telephone: string | null;
  created_at: string;
}

export function formatEvaluatorName(row: Pick<EvaluatorRow, 'prenom' | 'nom' | 'email'>): string {
  const full = [row.prenom, row.nom].filter(Boolean).join(' ').trim();
  if (full) return full;
  const email = row.email?.trim();
  if (email) return email.split('@')[0] || email;
  return 'Évaluateur';
}

export function evaluatorInitials(row: Pick<EvaluatorRow, 'prenom' | 'nom' | 'email'>): string {
  const p = row.prenom?.trim()?.[0];
  const n = row.nom?.trim()?.[0];
  if (p || n) return `${p ?? ''}${n ?? ''}`.toUpperCase();
  const email = row.email?.trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'ÉV';
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

export async function fetchEvaluatorsWithEmails(): Promise<EvaluatorRow[]> {
  const res = await fetch('/api/admin/evaluateurs');
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    evaluators?: EvaluatorRow[];
    error?: string;
  } | null;
  if (!res.ok || !data?.ok || !data.evaluators) {
    throw new Error(data?.error || 'Impossible de charger les évaluateurs.');
  }
  return data.evaluators;
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

/** Refus définitif : le compte repasse en rôle auteur et quitte la liste des évaluateurs. */
export async function rejectEvaluatorCompletely(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile, error: readError } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (readError) return readError.message;

  const role = profile?.role;
  if (role !== 'pair_en_attente' && role !== 'pair_valide') {
    return "Ce compte n'est pas une candidature ou un compte évaluateur actif.";
  }

  const { error } = await supabase
    .from('users_profile')
    .update({ role: 'auteur' })
    .eq('id', userId)
    .in('role', ['pair_en_attente', 'pair_valide']);

  if (error) return error.message;

  await notifyEvaluatorRejected(supabase, userId);
  return null;
}
