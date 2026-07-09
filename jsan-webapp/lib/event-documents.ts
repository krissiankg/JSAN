import type { SupabaseClient } from '@supabase/supabase-js';

export const EVENT_DOCUMENTS_BUCKET = 'event-documents';
export const INSTRUCTIONS_RESUME_FOLDER = 'instructions-resume';
export const INSTRUCTIONS_ARTICLE_FOLDER = 'instructions-article';

export const INSTRUCTION_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'] as const;
export type InstructionDocumentFormat = (typeof INSTRUCTION_ALLOWED_EXTENSIONS)[number];

const MIME_BY_EXTENSION: Record<InstructionDocumentFormat, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const MAX_INSTRUCTION_SIZE_MB = 20;

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

export function parseInstructionFormat(fileName: string): InstructionDocumentFormat | null {
  const ext = getFileExtension(fileName) as InstructionDocumentFormat;
  return INSTRUCTION_ALLOWED_EXTENSIONS.includes(ext) ? ext : null;
}

export function instructionFormatLabel(format: InstructionDocumentFormat | null | undefined): string {
  switch (format) {
    case 'pdf':
      return 'PDF';
    case 'doc':
      return 'DOC';
    case 'docx':
      return 'DOCX';
    default:
      return 'Document';
  }
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

export function buildInstructionsStoragePath(folder: string, eventConfigId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${folder}/${eventConfigId}/${Date.now()}-${safeName}`;
}

export function validateInstructionFile(file: File): string | null {
  const format = parseInstructionFormat(file.name);
  if (!format) {
    return `Format non autorisé. Utilisez : ${INSTRUCTION_ALLOWED_EXTENSIONS.join(', ')}.`;
  }
  const maxBytes = MAX_INSTRUCTION_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Fichier trop volumineux (max ${MAX_INSTRUCTION_SIZE_MB} Mo).`;
  }
  return null;
}

export async function uploadInstructionDocument(
  supabase: SupabaseClient,
  eventConfigId: string,
  file: File,
  folder: string = INSTRUCTIONS_RESUME_FOLDER
): Promise<{ storagePath: string; format: InstructionDocumentFormat; error: string | null }> {
  const validationError = validateInstructionFile(file);
  if (validationError) return { storagePath: '', format: 'pdf', error: validationError };

  const format = parseInstructionFormat(file.name)!;
  const storagePath = buildInstructionsStoragePath(folder, eventConfigId, file.name);
  const contentType = file.type || MIME_BY_EXTENSION[format];

  const { error } = await supabase.storage
    .from(EVENT_DOCUMENTS_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType });

  if (error) return { storagePath: '', format, error: error.message };
  return { storagePath, format, error: null };
}

export async function removeInstructionDocument(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  const { error } = await supabase.storage.from(EVENT_DOCUMENTS_BUCKET).remove([storagePath]);
  return error?.message ?? null;
}

export async function getEventDocumentSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EVENT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
