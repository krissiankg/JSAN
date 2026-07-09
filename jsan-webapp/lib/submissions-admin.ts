import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AbstractStatus,
  type Review,
  aggregateReviewScores,
  formatAbstractRef,
  abstractStatusLabel,
} from '@/lib/abstracts';
import { notifyAbstractDecision } from '@/lib/notifications';

export type SubmissionTab = 'ready' | 'in_progress' | 'decided' | 'all';

export type OrganizerDecision = 'Accepte' | 'A_Reviser' | 'Rejete';

export interface ReviewWithReviewer extends Review {
  reviewer?: { prenom: string | null; nom: string | null } | null;
}

export interface SubmissionRow {
  id: string;
  ref: string;
  titre: string;
  contenu_texte: string | null;
  thematique: string | null;
  statut: AbstractStatus;
  created_at: string;
  updated_at: string;
  authorName: string;
  authorInstitution: string | null;
  reviews: ReviewWithReviewer[];
  completedReviewCount: number;
  avgPertinence: number | null;
  avgQualite: number | null;
}

const SUBMISSION_SELECT = `
  id, author_id, titre, contenu_texte, thematique, statut, created_at, updated_at,
  author:users_profile!abstracts_author_id_fkey (prenom, nom, institution),
  reviews (
    id, abstract_id, reviewer_id, scores, commentaires_auteurs, commentaires_admin_secrets, statut, created_at, updated_at,
    reviewer:users_profile!reviews_reviewer_id_fkey (prenom, nom)
  )
`;

export function recommendationLabel(value: unknown): string {
  switch (value) {
    case 'accept':
      return 'Accepter sans modification';
    case 'accept_minor':
      return 'Accepter avec corrections mineures';
    case 'reject':
      return 'Refuser';
    case 'publish':
      return 'Favorable à la publication';
    case 'publish_minor':
      return 'Favorable sous réserve de corrections';
    default:
      return '—';
  }
}

export function confidentialNote(
  review: Pick<ReviewWithReviewer, 'scores' | 'commentaires_admin_secrets'>
): string | null {
  if (review.commentaires_admin_secrets?.trim()) {
    return review.commentaires_admin_secrets.trim();
  }
  if (!review.scores || typeof review.scores !== 'object') return null;
  const s = review.scores as Record<string, unknown>;
  if (typeof s.commentaires_confidentiels === 'string' && s.commentaires_confidentiels.trim()) {
    return s.commentaires_confidentiels.trim();
  }
  return null;
}

export function reviewerDisplayName(r: ReviewWithReviewer): string {
  const p = r.reviewer?.prenom;
  const n = r.reviewer?.nom;
  const full = [p, n].filter(Boolean).join(' ');
  return full || 'Évaluateur';
}

export function submissionTabLabel(tab: SubmissionTab): string {
  switch (tab) {
    case 'ready':
      return 'Prêts à décider';
    case 'in_progress':
      return 'En évaluation';
    case 'decided':
      return 'Décidés';
    default:
      return 'Tous';
  }
}

export function matchesSubmissionTab(row: SubmissionRow, tab: SubmissionTab): boolean {
  const pending = row.statut === 'Soumis' || row.statut === 'En_Evaluation';
  if (tab === 'ready') return pending && row.completedReviewCount > 0;
  if (tab === 'in_progress') return pending && row.completedReviewCount === 0;
  if (tab === 'decided') return row.statut === 'Accepte' || row.statut === 'Rejete' || row.statut === 'A_Reviser';
  return row.statut !== 'Brouillon';
}

export function decisionLabel(decision: OrganizerDecision): string {
  switch (decision) {
    case 'Accepte':
      return 'Accepter';
    case 'A_Reviser':
      return 'Demander une révision';
    case 'Rejete':
      return 'Refuser';
  }
}

export async function fetchSubmissionsForStaff(supabase: SupabaseClient): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('abstracts')
    .select(SUBMISSION_SELECT)
    .neq('statut', 'Brouillon')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => {
    const reviews = (row.reviews ?? []) as ReviewWithReviewer[];
    const completedReviewCount = reviews.filter((r) => r.statut === 'Complete').length;
    const avg = aggregateReviewScores(reviews);
    const author = row.author;

    return {
      id: row.id,
      ref: formatAbstractRef(row.id),
      titre: row.titre,
      contenu_texte: row.contenu_texte,
      thematique: row.thematique,
      statut: row.statut,
      created_at: row.created_at,
      updated_at: row.updated_at,
      authorName: [author?.prenom, author?.nom].filter(Boolean).join(' ') || 'Auteur',
      authorInstitution: author?.institution ?? null,
      reviews,
      completedReviewCount,
      avgPertinence: avg.pertinence,
      avgQualite: avg.qualite,
    } satisfies SubmissionRow;
  });
}

export async function setSubmissionDecision(
  supabase: SupabaseClient,
  abstractId: string,
  decision: OrganizerDecision
): Promise<string | null> {
  const { data: abstract, error: fetchErr } = await supabase
    .from('abstracts')
    .select('author_id, titre')
    .eq('id', abstractId)
    .single();

  if (fetchErr) return fetchErr.message;

  const { error } = await supabase
    .from('abstracts')
    .update({ statut: decision, updated_at: new Date().toISOString() })
    .eq('id', abstractId);

  if (error) return error.message;

  if (abstract?.author_id) {
    await notifyAbstractDecision(
      supabase,
      abstract.author_id,
      abstractId,
      abstract.titre ?? 'Votre résumé',
      decision
    );
  }

  return null;
}

export { abstractStatusLabel };
