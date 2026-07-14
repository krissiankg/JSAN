import type { InstructionDocumentFormat } from '@/lib/event-documents';
import { instructionFormatLabel, parseInstructionFormat } from '@/lib/event-documents';
import { OFFICIAL_PUBLIC_DOCS } from '@/lib/official-docs';

export interface InstructionDocument {
  title: string;
  description: string;
  storage_path?: string | null;
  file_name?: string | null;
  format?: InstructionDocumentFormat | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
  /** Fichier public de repli (ex. PDF officiel dans /public) */
  public_url?: string | null;
}

export const DEFAULT_RESUME_INSTRUCTIONS: InstructionDocument = {
  title: 'Instructions aux auteurs',
  description: 'Consignes officielles JSAN pour la soumission des résumés',
  public_url: OFFICIAL_PUBLIC_DOCS.instructionsAuteurs.path,
  file_name: OFFICIAL_PUBLIC_DOCS.instructionsAuteurs.fileName,
  format: 'pdf',
};

export const DEFAULT_ARTICLE_INSTRUCTIONS: InstructionDocument = {
  title: 'Guide de soumission des articles complets',
  description: 'Consignes officielles JSAN pour les manuscrits — document publié par l\'organisateur (PDF ou Word)',
};

export const DEFAULT_EVALUATION_CRITERIA: InstructionDocument = {
  title: OFFICIAL_PUBLIC_DOCS.criteresEvaluation.title,
  description: 'Grille et critères officiels pour l’évaluation des résumés',
  public_url: OFFICIAL_PUBLIC_DOCS.criteresEvaluation.path,
  file_name: OFFICIAL_PUBLIC_DOCS.criteresEvaluation.fileName,
  format: 'pdf',
};

export type InstructionConfigKey = 'instructions_resume' | 'instructions_article' | 'criteres_evaluation';

export interface DocumentsConfig {
  instructions_resume: InstructionDocument;
  instructions_article: InstructionDocument;
  criteres_evaluation: InstructionDocument;
}

export function isInstructionDocumentPublished(doc: InstructionDocument): boolean {
  return Boolean((doc.storage_path && doc.file_name) || doc.public_url);
}

export function parseInstructionDocument(
  value: unknown,
  fallback: InstructionDocument = DEFAULT_RESUME_INSTRUCTIONS
): InstructionDocument {
  if (!value || typeof value !== 'object') return { ...fallback };
  const doc = value as Record<string, unknown>;

  const fileName = typeof doc.file_name === 'string' ? doc.file_name : fallback.file_name ?? null;
  const format =
    doc.format === 'pdf' || doc.format === 'doc' || doc.format === 'docx'
      ? doc.format
      : fileName
        ? parseInstructionFormat(fileName)
        : fallback.format ?? null;

  return {
    title: typeof doc.title === 'string' ? doc.title : fallback.title,
    description: typeof doc.description === 'string' ? doc.description : fallback.description,
    storage_path: typeof doc.storage_path === 'string' ? doc.storage_path : null,
    file_name: fileName,
    format,
    uploaded_at: typeof doc.uploaded_at === 'string' ? doc.uploaded_at : null,
    uploaded_by: typeof doc.uploaded_by === 'string' ? doc.uploaded_by : null,
    public_url:
      typeof doc.public_url === 'string'
        ? doc.public_url
        : (!doc.storage_path ? fallback.public_url ?? null : null),
  };
}

export function parseDocumentsConfig(value: unknown): DocumentsConfig {
  if (!value || typeof value !== 'object') {
    return {
      instructions_resume: { ...DEFAULT_RESUME_INSTRUCTIONS },
      instructions_article: { ...DEFAULT_ARTICLE_INSTRUCTIONS },
      criteres_evaluation: { ...DEFAULT_EVALUATION_CRITERIA },
    };
  }
  const config = value as Record<string, unknown>;
  return {
    instructions_resume: parseInstructionDocument(config.instructions_resume, DEFAULT_RESUME_INSTRUCTIONS),
    instructions_article: parseInstructionDocument(config.instructions_article, DEFAULT_ARTICLE_INSTRUCTIONS),
    criteres_evaluation: parseInstructionDocument(config.criteres_evaluation, DEFAULT_EVALUATION_CRITERIA),
  };
}

export function buildInstructionsPayload(
  doc: InstructionDocument,
  storagePath: string,
  fileName: string,
  userId: string
): InstructionDocument {
  const format = parseInstructionFormat(fileName);
  return {
    title: doc.title,
    description: doc.description,
    storage_path: storagePath,
    file_name: fileName,
    format,
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
    public_url: null,
  };
}

export function buildInstructionsResumePayload(
  doc: InstructionDocument,
  storagePath: string,
  fileName: string,
  userId: string
): InstructionDocument {
  return buildInstructionsPayload(doc, storagePath, fileName, userId);
}

export function buildInstructionsArticlePayload(
  doc: InstructionDocument,
  storagePath: string,
  fileName: string,
  userId: string
): InstructionDocument {
  return buildInstructionsPayload(doc, storagePath, fileName, userId);
}

export function buildEvaluationCriteriaPayload(
  doc: InstructionDocument,
  storagePath: string,
  fileName: string,
  userId: string
): InstructionDocument {
  return buildInstructionsPayload(
    { ...doc, title: doc.title || DEFAULT_EVALUATION_CRITERIA.title },
    storagePath,
    fileName,
    userId
  );
}

export { instructionFormatLabel };
