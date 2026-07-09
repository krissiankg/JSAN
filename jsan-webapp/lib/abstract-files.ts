import type { SupabaseClient } from '@supabase/supabase-js';
import type { AbstractFile } from '@/lib/abstracts';

export const ABSTRACT_FILES_BUCKET = 'abstract-files';

export interface UploadRules {
  max_files: number;
  max_size_mb: number;
  allowed_extensions: string[];
}

export const DEFAULT_UPLOAD_RULES: UploadRules = {
  max_files: 3,
  max_size_mb: 10,
  allowed_extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function parseUploadRules(value: unknown): UploadRules {
  if (!value || typeof value !== 'object') return DEFAULT_UPLOAD_RULES;
  const rules = value as Record<string, unknown>;
  const allowed = Array.isArray(rules.allowed_extensions)
    ? rules.allowed_extensions.map((ext) => String(ext).toLowerCase().replace(/^\./, ''))
    : DEFAULT_UPLOAD_RULES.allowed_extensions;

  return {
    max_files: typeof rules.max_files === 'number' ? rules.max_files : DEFAULT_UPLOAD_RULES.max_files,
    max_size_mb: typeof rules.max_size_mb === 'number' ? rules.max_size_mb : DEFAULT_UPLOAD_RULES.max_size_mb,
    allowed_extensions: allowed.length ? allowed : DEFAULT_UPLOAD_RULES.allowed_extensions,
  };
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

export function buildStoragePath(userId: string, abstractId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${userId}/${abstractId}/${Date.now()}-${safeName}`;
}

export function validateAbstractFile(file: File, rules: UploadRules, currentCount: number): string | null {
  if (currentCount >= rules.max_files) {
    return `Maximum ${rules.max_files} fichier(s) par résumé.`;
  }

  const extension = getFileExtension(file.name);
  if (!extension || !rules.allowed_extensions.includes(extension)) {
    return `Format non autorisé. Extensions acceptées : ${rules.allowed_extensions.join(', ')}.`;
  }

  const maxBytes = rules.max_size_mb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Fichier trop volumineux (max ${rules.max_size_mb} Mo).`;
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export async function uploadAbstractFile(
  supabase: SupabaseClient,
  userId: string,
  abstractId: string,
  file: File
): Promise<{ data: AbstractFile | null; error: string | null }> {
  const extension = getFileExtension(file.name);
  const storagePath = buildStoragePath(userId, abstractId, file.name);
  const contentType = file.type || MIME_BY_EXTENSION[extension] || 'application/octet-stream';

  const { error: uploadError } = await supabase.storage
    .from(ABSTRACT_FILES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data, error: insertError } = await supabase
    .from('abstract_files')
    .insert({
      abstract_id: abstractId,
      file_url: storagePath,
      file_name: file.name,
      file_type: extension || null,
      file_size_mb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      type_document: 'Resume_Principal',
    })
    .select('id, abstract_id, file_url, file_name, file_type')
    .single();

  if (insertError || !data) {
    await supabase.storage.from(ABSTRACT_FILES_BUCKET).remove([storagePath]);
    return { data: null, error: insertError?.message ?? 'Erreur lors de l\'enregistrement du fichier.' };
  }

  return { data: data as AbstractFile, error: null };
}

export async function deleteAbstractFileRecord(
  supabase: SupabaseClient,
  file: Pick<AbstractFile, 'id' | 'file_url'>
): Promise<string | null> {
  const { error: storageError } = await supabase.storage.from(ABSTRACT_FILES_BUCKET).remove([file.file_url]);
  if (storageError) return storageError.message;

  const { error: dbError } = await supabase.from('abstract_files').delete().eq('id', file.id);
  return dbError?.message ?? null;
}

export async function deleteAllAbstractFiles(
  supabase: SupabaseClient,
  files: Pick<AbstractFile, 'id' | 'file_url'>[]
): Promise<void> {
  if (!files.length) return;
  await supabase.storage.from(ABSTRACT_FILES_BUCKET).remove(files.map((f) => f.file_url));
  await supabase.from('abstract_files').delete().in('id', files.map((f) => f.id));
}

export async function getAbstractFileSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ABSTRACT_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
