import type { SupabaseClient } from '@supabase/supabase-js';
import type { Review, ReviewStatus } from '@/lib/abstracts';
import { formatAbstractRef } from '@/lib/abstracts';
import { formatArticleRef } from '@/lib/full-articles';
import { fetchAssignedAbstractIds } from '@/lib/review-assignments';

/** Statut d'évaluation affiché dans le tableau (côté évaluateur). */
export type EvaluationDisplayStatus = 'À évaluer' | 'En cours' | 'Évalué';

export interface AssignedAbstract {
  id: string;
  ref: string;
  title: string;
  thematic: string;
  abstractText: string;
  deadline: string;
  status: EvaluationDisplayStatus;
  fileName: string | null;
  filePath: string | null;
  fileType: string | null;
  myReview: Review | null;
  /** Renseigné seulement si le double aveugle est désactivé. */
  authorLabel: string | null;
}

export interface AssignedArticle {
  id: string;
  abstractId: string;
  ref: string;
  title: string;
  thematic: string;
  deadline: string;
  status: EvaluationDisplayStatus;
  fileName: string | null;
  filePath: string | null;
  fileSize: string;
  myReviewId: string | null;
  myReviewStatus: ReviewStatus | null;
  myReview: Review | null;
  authorLabel: string | null;
}

/** Décision de recommandation stockée dans scores.recommandation */
export type ReviewRecommendation = 'accept' | 'accept_minor' | 'reject' | '';

export interface ReviewFormValues {
  critere1: number;
  critere2: number;
  critere3: number;
  commentaire: string;
  recommandation: string;
  commentairesConfidentiels?: string;
}

const ASSIGNED_ABSTRACT_SELECT = `
  id, author_id, titre, contenu_texte, thematique, statut, created_at, updated_at,
  abstract_files (id, abstract_id, file_name, file_url, file_type),
  reviews (id, abstract_id, reviewer_id, scores, commentaires_auteurs, commentaires_admin_secrets, statut, created_at, updated_at)
`;

function takeFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function deriveDeadline(iso: string, days = 21): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayStatusFromReview(review: Review | null): EvaluationDisplayStatus {
  if (!review) return 'À évaluer';
  if (review.statut === 'Complete') return 'Évalué';
  return 'En cours';
}

/** Résumés assignés à l'évaluateur (via table reviews). */
export async function fetchAssignedAbstracts(
  supabase: SupabaseClient,
  reviewerId: string
): Promise<AssignedAbstract[]> {
  const assignedIds = await fetchAssignedAbstractIds(supabase, reviewerId);
  if (!assignedIds.length) return [];

  const { data, error } = await supabase
    .from('abstracts')
    .select(ASSIGNED_ABSTRACT_SELECT)
    .in('id', assignedIds)
    .neq('statut', 'Brouillon')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const authorLabels = new Map<string, string | null>();
  await Promise.all(
    rows.map(async (row: { id: string }) => {
      try {
        const { data: label, error: rpcError } = await supabase.rpc('get_submission_author_label', {
          abstract_uuid: row.id,
        });
        authorLabels.set(row.id, !rpcError && typeof label === 'string' ? label : null);
      } catch {
        authorLabels.set(row.id, null);
      }
    })
  );

  return rows.map((row: any) => {
    const myReview: Review | null =
      (row.reviews ?? []).find((r: Review) => r.reviewer_id === reviewerId) ?? null;
    const mainFile = (row.abstract_files ?? [])[0] ?? null;

    return {
      id: row.id,
      ref: formatAbstractRef(row.id),
      title: row.titre,
      thematic: row.thematique ?? 'Non spécifiée',
      abstractText: row.contenu_texte ?? 'Aucun contenu fourni pour ce résumé.',
      deadline: deriveDeadline(row.created_at),
      status: displayStatusFromReview(myReview),
      fileName: mainFile?.file_name ?? null,
      filePath: mainFile?.file_url ?? null,
      fileType: mainFile?.file_type ?? null,
      myReview,
      authorLabel: authorLabels.get(row.id) ?? null,
    } as AssignedAbstract;
  });
}

/** Manuscrits dont le résumé parent est assigné à l'évaluateur. */
export async function fetchAssignedArticles(
  supabase: SupabaseClient,
  reviewerId: string
): Promise<AssignedArticle[]> {
  const assignedIds = await fetchAssignedAbstractIds(supabase, reviewerId);
  if (!assignedIds.length) return [];

  const { data, error } = await supabase
    .from('full_articles')
    .select(`
      id, abstract_id, author_id, titre, statut, created_at,
      full_article_files (id, file_name, file_url, file_type, file_size_mb, type_document),
      abstracts (id, thematique)
    `)
    .in('abstract_id', assignedIds)
    .neq('statut', 'Brouillon')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const abstractIds = rows.map((r: any) => r.abstract_id).filter(Boolean);

  const reviewsByAbstract = new Map<string, Review>();
  if (abstractIds.length) {
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('id, abstract_id, reviewer_id, scores, commentaires_auteurs, commentaires_admin_secrets, statut, created_at, updated_at')
      .eq('reviewer_id', reviewerId)
      .in('abstract_id', abstractIds);
    for (const rev of (reviewRows ?? []) as Review[]) {
      reviewsByAbstract.set(rev.abstract_id, rev);
    }
  }

  return Promise.all(
    rows.map(async (row: any) => {
      const myReview: Review | null = reviewsByAbstract.get(row.abstract_id) ?? null;
      const abstract = takeFirstRelation(row.abstracts);
      const mainFile =
        (row.full_article_files ?? []).find((f: any) => f.type_document === 'Manuscrit_Principal')
        ?? (row.full_article_files ?? [])[0]
        ?? null;
      const sizeMb = mainFile?.file_size_mb ? `${mainFile.file_size_mb} MB` : '—';

      let authorLabel: string | null = null;
      try {
        const { data: label, error: rpcError } = await supabase.rpc('get_submission_author_label', {
          abstract_uuid: row.abstract_id,
        });
        authorLabel = !rpcError && typeof label === 'string' ? label : null;
      } catch {
        authorLabel = null;
      }

      return {
        id: row.id,
        abstractId: row.abstract_id,
        ref: formatArticleRef(row.id),
        title: row.titre,
        thematic: abstract?.thematique ?? 'Non spécifiée',
        deadline: deriveDeadline(row.created_at, 30),
        status: displayStatusFromReview(myReview),
        fileName: mainFile?.file_name ?? null,
        filePath: mainFile?.file_url ?? null,
        fileSize: sizeMb,
        myReviewId: myReview?.id ?? null,
        myReviewStatus: myReview?.statut ?? null,
        myReview,
        authorLabel,
      } as AssignedArticle;
    })
  );
}

/**
 * Enregistre (ou met à jour) l'évaluation d'un résumé par l'évaluateur courant.
 * Les 3 critères de la grille sont stockés dans scores ; pertinence/qualite
 * alimentent les agrégats déjà utilisés côté auteur.
 */
export async function submitAbstractReview(
  supabase: SupabaseClient,
  params: {
    abstractId: string;
    reviewerId: string;
    existingReviewId: string | null;
    values: ReviewFormValues;
    complete: boolean;
  }
): Promise<string | null> {
  const { abstractId, reviewerId, existingReviewId, values, complete } = params;

  const scores = {
    originalite: values.critere1,
    methodologie: values.critere2,
    pertinence: values.critere3,
    qualite: Math.round(((values.critere1 + values.critere2) / 2) * 10) / 10,
    recommandation: values.recommandation || null,
  };

  const payload = {
    abstract_id: abstractId,
    reviewer_id: reviewerId,
    scores,
    commentaires_auteurs: values.commentaire || null,
    commentaires_admin_secrets: values.commentairesConfidentiels?.trim() || null,
    statut: (complete ? 'Complete' : 'En_Attente') as ReviewStatus,
    updated_at: new Date().toISOString(),
  };

  if (existingReviewId) {
    const { error } = await supabase.from('reviews').update(payload).eq('id', existingReviewId);
    return error?.message ?? null;
  }

  const { error } = await supabase.from('reviews').insert(payload);
  return error?.message ?? null;
}
