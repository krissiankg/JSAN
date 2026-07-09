export type AbstractStatus =
  | 'Brouillon'
  | 'Soumis'
  | 'En_Evaluation'
  | 'Accepte'
  | 'Rejete'
  | 'A_Reviser';

export interface AbstractAuthor {
  id?: string;
  abstract_id?: string;
  nom: string;
  prenom: string;
  email: string;
  affiliation: string;
  est_orateur: boolean;
  ordre_affichage?: number;
}

export interface AbstractFile {
  id: string;
  abstract_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

export type ReviewStatus = 'En_Attente' | 'Complete';

export interface ReviewScores {
  pertinence?: number;
  qualite?: number;
  [key: string]: unknown;
}

export interface Review {
  id: string;
  abstract_id: string;
  reviewer_id: string;
  scores: ReviewScores | null;
  commentaires_auteurs: string | null;
  commentaires_admin_secrets?: string | null;
  statut: ReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface Abstract {
  id: string;
  author_id: string;
  titre: string;
  contenu_texte: string | null;
  mots_cles: string | null;
  thematique: string | null;
  type_presentation_global: string | null;
  statut: AbstractStatus;
  created_at: string;
  updated_at: string;
  abstract_authors?: AbstractAuthor[];
  abstract_files?: AbstractFile[];
  reviews?: Review[];
}

export interface EventFormConfig {
  themes_disponibles: string[];
  types_presentation: string[];
  upload_rules?: { max_files?: number; max_size_mb?: number };
}

export const ABSTRACT_SELECT = `
  id, author_id, titre, contenu_texte, mots_cles, thematique,
  type_presentation_global, statut, created_at, updated_at,
  abstract_authors (id, nom, prenom, email, affiliation, est_orateur, ordre_affichage),
  abstract_files (id, abstract_id, file_name, file_url, file_type)
`;

export function abstractStatusLabel(status: AbstractStatus): string {
  switch (status) {
    case 'Brouillon':
      return 'Brouillon';
    case 'Soumis':
      return 'Soumis';
    case 'En_Evaluation':
      return "En cours d'évaluation";
    case 'Accepte':
      return 'Accepté';
    case 'Rejete':
      return 'Rejeté';
    case 'A_Reviser':
      return 'À réviser';
    default:
      return status;
  }
}

export function abstractStatusStyle(status: AbstractStatus): { background: string; color: string; border?: string } {
  switch (status) {
    case 'En_Evaluation':
      return { background: '#e0e7ff', color: '#4338ca' };
    case 'Accepte':
      return { background: '#dcfce7', color: '#166534' };
    case 'Rejete':
      return { background: '#fee2e2', color: '#b91c1c' };
    case 'A_Reviser':
      return { background: '#fef3c7', color: '#b45309' };
    case 'Soumis':
      return { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
    default:
      return { background: '#f1f5f9', color: '#475569' };
  }
}

export function formatAbstractDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCoAuthors(authors: AbstractAuthor[] | undefined): string {
  if (!authors?.length) return '—';
  return authors
    .map((a) => `${a.prenom} ${a.nom}`.trim())
    .filter(Boolean)
    .join(', ');
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const DEFAULT_THEMES = ['Nutrition clinique', 'Sécurité sanitaire', 'Nutrition infantile', 'Santé publique'];
export const DEFAULT_PRESENTATION_TYPES = ['Oral', 'Poster'];

export const ABSTRACT_WITH_REVIEWS_SELECT = `
  id, author_id, titre, thematique, statut, created_at, updated_at,
  reviews (id, abstract_id, reviewer_id, scores, commentaires_auteurs, statut, created_at, updated_at)
`;

export const ABSTRACT_DETAIL_SELECT = `
  id, author_id, titre, contenu_texte, mots_cles, thematique,
  type_presentation_global, statut, created_at, updated_at,
  abstract_authors (id, nom, prenom, email, affiliation, est_orateur, ordre_affichage),
  abstract_files (id, abstract_id, file_name, file_url, file_type),
  reviews (id, abstract_id, reviewer_id, scores, commentaires_auteurs, statut, created_at, updated_at)
`;

export function formatAbstractRef(id: string): string {
  return `RES-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export function parseReviewScores(scores: unknown): { pertinence: number | null; qualite: number | null } {
  if (!scores || typeof scores !== 'object') return { pertinence: null, qualite: null };
  const s = scores as Record<string, unknown>;
  const pertinence = typeof s.pertinence === 'number' ? s.pertinence : null;
  const qualite = typeof s.qualite === 'number' ? s.qualite : null;
  return { pertinence, qualite };
}

export function aggregateReviewScores(reviews: Review[] | undefined): { pertinence: number | null; qualite: number | null } {
  const completed = (reviews ?? []).filter((r) => r.statut === 'Complete');
  if (!completed.length) return { pertinence: null, qualite: null };

  let pertinenceSum = 0;
  let qualiteSum = 0;
  let pertinenceCount = 0;
  let qualiteCount = 0;

  for (const review of completed) {
    const { pertinence, qualite } = parseReviewScores(review.scores);
    if (pertinence !== null) {
      pertinenceSum += pertinence;
      pertinenceCount += 1;
    }
    if (qualite !== null) {
      qualiteSum += qualite;
      qualiteCount += 1;
    }
  }

  return {
    pertinence: pertinenceCount ? Math.round((pertinenceSum / pertinenceCount) * 10) / 10 : null,
    qualite: qualiteCount ? Math.round((qualiteSum / qualiteCount) * 10) / 10 : null,
  };
}

export function formatReviewerComment(reviews: Review[] | undefined): string {
  const comments = (reviews ?? [])
    .filter((r) => r.statut === 'Complete' && r.commentaires_auteurs?.trim())
    .map((r) => r.commentaires_auteurs!.trim());
  if (!comments.length) return 'Aucun commentaire disponible pour le moment.';
  return comments.join(' ');
}

export function formatScoreDisplay(value: number | null): string {
  if (value === null) return '—';
  return `${value}/5`;
}
