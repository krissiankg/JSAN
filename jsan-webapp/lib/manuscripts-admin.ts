import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type Review,
  aggregateReviewScores,
} from '@/lib/abstracts';
import {
  type FullArticleStatus,
  formatArticleRef,
  fullArticleStatusLabel,
} from '@/lib/full-articles';
import {
  type ReviewWithReviewer,
  confidentialNote,
  recommendationLabel,
  reviewerDisplayName,
} from '@/lib/submissions-admin';
import { notifyManuscriptDecision } from '@/lib/notifications';

export type ManuscriptTab = 'ready' | 'in_progress' | 'decided' | 'all';

/** Décision finale sur un manuscrit (enum full_article_status). */
export type ManuscriptDecision = 'Accepte' | 'Rejete' | 'Soumis';

export interface ManuscriptRow {
  id: string;
  abstractId: string;
  ref: string;
  titre: string;
  thematique: string | null;
  statut: FullArticleStatus;
  created_at: string;
  updated_at: string;
  authorName: string;
  authorInstitution: string | null;
  fileName: string | null;
  filePath: string | null;
  reviews: ReviewWithReviewer[];
  completedReviewCount: number;
  avgPertinence: number | null;
  avgQualite: number | null;
}

const MANUSCRIPT_SELECT = `
  id, abstract_id, author_id, titre, statut, created_at, updated_at,
  author:users_profile!full_articles_author_id_fkey (prenom, nom, institution),
  full_article_files (file_name, file_url, file_type, file_size_mb, type_document),
  abstracts (id, thematique, titre)
`;

function takeFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function manuscriptTabLabel(tab: ManuscriptTab): string {
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

export function matchesManuscriptTab(row: ManuscriptRow, tab: ManuscriptTab): boolean {
  const pending = row.statut === 'Soumis' || row.statut === 'En_Evaluation';
  if (tab === 'ready') return pending && row.completedReviewCount > 0;
  if (tab === 'in_progress') return pending && row.completedReviewCount === 0;
  if (tab === 'decided') return row.statut === 'Accepte' || row.statut === 'Rejete' || row.statut === 'Publie';
  return row.statut !== 'Brouillon';
}

export function manuscriptDecisionLabel(decision: ManuscriptDecision): string {
  switch (decision) {
    case 'Accepte':
      return 'Accepter pour publication';
    case 'Rejete':
      return 'Refuser la publication';
    case 'Soumis':
      return 'Demander des corrections';
  }
}

export async function fetchManuscriptsForStaff(supabase: SupabaseClient): Promise<ManuscriptRow[]> {
  const { data, error } = await supabase
    .from('full_articles')
    .select(MANUSCRIPT_SELECT)
    .neq('statut', 'Brouillon')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const abstractIds = rows.map((r: { abstract_id: string }) => r.abstract_id).filter(Boolean);

  const reviewsByAbstract = new Map<string, ReviewWithReviewer[]>();
  if (abstractIds.length) {
    const { data: reviewRows, error: revErr } = await supabase
      .from('reviews')
      .select(`
        id, abstract_id, reviewer_id, scores, commentaires_auteurs, commentaires_admin_secrets, statut, created_at, updated_at,
        reviewer:users_profile!reviews_reviewer_id_fkey (prenom, nom)
      `)
      .in('abstract_id', abstractIds);

    if (revErr) throw new Error(revErr.message);

    for (const rawReview of reviewRows ?? []) {
      const review = rawReview as ReviewWithReviewer & {
        reviewer?: ReviewWithReviewer['reviewer'][];
      };
      const rev: ReviewWithReviewer = {
        ...review,
        reviewer: takeFirstRelation(review.reviewer),
      };
      const list = reviewsByAbstract.get(rev.abstract_id) ?? [];
      list.push(rev);
      reviewsByAbstract.set(rev.abstract_id, list);
    }
  }

  return rows.map((row: any) => {
    const reviews = reviewsByAbstract.get(row.abstract_id) ?? [];
    const completedReviewCount = reviews.filter((r) => r.statut === 'Complete').length;
    const avg = aggregateReviewScores(reviews);
    const author = takeFirstRelation(row.author);
    const abstract = takeFirstRelation(row.abstracts);
    const mainFile =
      (row.full_article_files ?? []).find((f: { type_document: string }) => f.type_document === 'Manuscrit_Principal')
      ?? (row.full_article_files ?? [])[0]
      ?? null;

    return {
      id: row.id,
      abstractId: row.abstract_id,
      ref: formatArticleRef(row.id),
      titre: row.titre,
      thematique: abstract?.thematique ?? null,
      statut: row.statut,
      created_at: row.created_at,
      updated_at: row.updated_at,
      authorName: [author?.prenom, author?.nom].filter(Boolean).join(' ') || 'Auteur',
      authorInstitution: author?.institution ?? null,
      fileName: mainFile?.file_name ?? null,
      filePath: mainFile?.file_url ?? null,
      reviews,
      completedReviewCount,
      avgPertinence: avg.pertinence,
      avgQualite: avg.qualite,
    } satisfies ManuscriptRow;
  });
}

export async function setManuscriptDecision(
  supabase: SupabaseClient,
  manuscriptId: string,
  decision: ManuscriptDecision
): Promise<string | null> {
  const { data: manuscript, error: fetchErr } = await supabase
    .from('full_articles')
    .select('author_id, titre')
    .eq('id', manuscriptId)
    .single();

  if (fetchErr) return fetchErr.message;

  const { error } = await supabase
    .from('full_articles')
    .update({ statut: decision, updated_at: new Date().toISOString() })
    .eq('id', manuscriptId);

  if (error) return error.message;

  if (manuscript?.author_id) {
    await notifyManuscriptDecision(
      supabase,
      manuscript.author_id,
      manuscript.titre ?? 'Votre manuscrit',
      decision
    );
  }

  return null;
}

export {
  fullArticleStatusLabel,
  confidentialNote,
  recommendationLabel,
  reviewerDisplayName,
};
