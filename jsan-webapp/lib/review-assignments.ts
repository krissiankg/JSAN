import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvaluatorRow } from '@/lib/evaluators-admin';
import { formatEvaluatorName } from '@/lib/evaluators-admin';
import { notifyReviewerAssignment } from '@/lib/notifications';

/** Assigne un évaluateur validé à un résumé (crée une ligne reviews En_Attente). */
export async function assignReviewerToAbstract(
  supabase: SupabaseClient,
  abstractId: string,
  reviewerId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('abstract_id', abstractId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();

  if (existing) return null;

  const { error: insertErr } = await supabase.from('reviews').insert({
    abstract_id: abstractId,
    reviewer_id: reviewerId,
    statut: 'En_Attente',
    scores: null,
  });

  if (insertErr) return insertErr.message;

  const { data: abstract } = await supabase
    .from('abstracts')
    .select('titre')
    .eq('id', abstractId)
    .maybeSingle();

  await notifyReviewerAssignment(
    supabase,
    reviewerId,
    abstractId,
    abstract?.titre ?? 'Soumission'
  );

  await supabase
    .from('abstracts')
    .update({ statut: 'En_Evaluation', updated_at: new Date().toISOString() })
    .eq('id', abstractId)
    .eq('statut', 'Soumis');

  return null;
}

/** Retire une assignation (uniquement si l'évaluation n'est pas terminée). */
export async function unassignReviewer(
  supabase: SupabaseClient,
  reviewId: string
): Promise<string | null> {
  const { data: review } = await supabase
    .from('reviews')
    .select('id, statut')
    .eq('id', reviewId)
    .maybeSingle();

  if (!review) return 'Assignation introuvable.';
  if (review.statut === 'Complete') {
    return 'Impossible de retirer un évaluateur ayant déjà soumis son évaluation.';
  }

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  return error?.message ?? null;
}

export async function fetchValidatedEvaluators(supabase: SupabaseClient): Promise<EvaluatorRow[]> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, prenom, nom, role, specialite, institution, telephone, created_at')
    .eq('role', 'pair_valide')
    .order('nom', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluatorRow[];
}

export async function fetchAssignedAbstractIds(
  supabase: SupabaseClient,
  reviewerId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('abstract_id')
    .eq('reviewer_id', reviewerId);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.abstract_id as string))];
}

export function evaluatorOptionLabel(row: EvaluatorRow): string {
  const name = formatEvaluatorName(row);
  return row.specialite ? `${name} — ${row.specialite}` : name;
}
