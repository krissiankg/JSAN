import type { InstructionDocumentFormat } from '@/lib/event-documents';
import { instructionFormatLabel, parseInstructionFormat } from '@/lib/event-documents';

export interface InstructionDocument {
  title: string;
  description: string;
  storage_path?: string | null;
  file_name?: string | null;
  format?: InstructionDocumentFormat | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
}

export const DEFAULT_RESUME_INSTRUCTIONS: InstructionDocument = {
  title: 'Guide de soumission des résumés',
  description: 'Consignes officielles JSAN — document publié par l\'organisateur (PDF ou Word)',
};

export const DEFAULT_ARTICLE_INSTRUCTIONS: InstructionDocument = {
  title: 'Guide de soumission des articles complets',
  description: 'Consignes officielles JSAN pour les manuscrits — document publié par l\'organisateur (PDF ou Word)',
};

export type InstructionConfigKey = 'instructions_resume' | 'instructions_article';

export interface DocumentsConfig {
  instructions_resume: InstructionDocument;
  instructions_article: InstructionDocument;
}

export function isInstructionDocumentPublished(doc: InstructionDocument): boolean {
  return Boolean(doc.storage_path && doc.file_name);
}

export function parseInstructionDocument(value: unknown): InstructionDocument {
  if (!value || typeof value !== 'object') return { ...DEFAULT_RESUME_INSTRUCTIONS };
  const doc = value as Record<string, unknown>;

  const fileName = typeof doc.file_name === 'string' ? doc.file_name : null;
  const format =
    doc.format === 'pdf' || doc.format === 'doc' || doc.format === 'docx'
      ? doc.format
      : fileName
        ? parseInstructionFormat(fileName)
        : null;

  return {
    title: typeof doc.title === 'string' ? doc.title : DEFAULT_RESUME_INSTRUCTIONS.title,
    description: typeof doc.description === 'string' ? doc.description : DEFAULT_RESUME_INSTRUCTIONS.description,
    storage_path: typeof doc.storage_path === 'string' ? doc.storage_path : null,
    file_name: fileName,
    format,
    uploaded_at: typeof doc.uploaded_at === 'string' ? doc.uploaded_at : null,
    uploaded_by: typeof doc.uploaded_by === 'string' ? doc.uploaded_by : null,
  };
}

export function parseDocumentsConfig(value: unknown): DocumentsConfig {
  if (!value || typeof value !== 'object') {
    return {
      instructions_resume: { ...DEFAULT_RESUME_INSTRUCTIONS },
      instructions_article: { ...DEFAULT_ARTICLE_INSTRUCTIONS },
    };
  }
  const config = value as Record<string, unknown>;
  return {
    instructions_resume: parseInstructionDocument(config.instructions_resume ?? DEFAULT_RESUME_INSTRUCTIONS),
    instructions_article: parseInstructionDocument(config.instructions_article ?? DEFAULT_ARTICLE_INSTRUCTIONS),
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

export { instructionFormatLabel };
