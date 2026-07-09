export type FullArticleStatus =
  | 'Brouillon'
  | 'Soumis'
  | 'En_Evaluation'
  | 'Accepte'
  | 'Rejete'
  | 'Publie';

export interface FullArticleFile {
  id: string;
  full_article_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  type_document: string | null;
}

export interface FullArticle {
  id: string;
  abstract_id: string;
  author_id: string;
  titre: string;
  mots_cles: string | null;
  declaration_conflit: boolean;
  declaration_plagiat: boolean;
  statut: FullArticleStatus;
  created_at: string;
  updated_at: string;
  full_article_files?: FullArticleFile[];
  abstracts?: { id: string; titre: string; thematique: string | null };
}

export const FULL_ARTICLE_SELECT = `
  id, abstract_id, author_id, titre, mots_cles,
  declaration_conflit, declaration_plagiat, statut, created_at, updated_at,
  full_article_files (id, full_article_id, file_url, file_name, file_type, type_document),
  abstracts (id, titre, thematique)
`;

function takeFirstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function normalizeFullArticle(raw: unknown): FullArticle {
  const row = raw as Record<string, unknown>;
  const abstract = takeFirstRelation(row.abstracts as FullArticle['abstracts'] | FullArticle['abstracts'][] | null | undefined);

  return {
    id: String(row.id ?? ''),
    abstract_id: String(row.abstract_id ?? ''),
    author_id: String(row.author_id ?? ''),
    titre: String(row.titre ?? ''),
    mots_cles: typeof row.mots_cles === 'string' ? row.mots_cles : null,
    declaration_conflit: Boolean(row.declaration_conflit),
    declaration_plagiat: Boolean(row.declaration_plagiat),
    statut: row.statut as FullArticleStatus,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    full_article_files: Array.isArray(row.full_article_files)
      ? row.full_article_files as FullArticleFile[]
      : [],
    abstracts: abstract,
  };
}

export function fullArticleStatusLabel(status: FullArticleStatus): string {
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
    case 'Publie':
      return 'Publié';
    default:
      return status;
  }
}

export function fullArticleStatusStyle(status: FullArticleStatus): { background: string; color: string } {
  switch (status) {
    case 'En_Evaluation':
      return { background: '#e0e7ff', color: '#4338ca' };
    case 'Accepte':
    case 'Publie':
      return { background: '#dcfce7', color: '#166534' };
    case 'Rejete':
      return { background: '#fee2e2', color: '#b91c1c' };
    case 'Soumis':
      return { background: '#f8fafc', color: '#64748b' };
    default:
      return { background: '#f1f5f9', color: '#475569' };
  }
}

export function formatArticleRef(id: string): string {
  return `ART-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export function formatFullArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function tabMatchesStatus(tab: string, status: FullArticleStatus): boolean {
  switch (tab) {
    case 'En Évaluation':
      return status === 'En_Evaluation' || status === 'Soumis';
    case 'Acceptés':
      return status === 'Accepte';
    case 'Publiés':
      return status === 'Publie';
    case 'Tous':
    default:
      return status !== 'Brouillon';
  }
}
