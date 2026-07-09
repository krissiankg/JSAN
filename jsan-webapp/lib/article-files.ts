import type { SupabaseClient } from '@supabase/supabase-js';
import type { FullArticleFile } from '@/lib/full-articles';

export const ARTICLE_FILES_BUCKET = 'article-files';
export const MAX_ARTICLE_FILE_MB = 20;

const ALLOWED_MAIN = ['pdf', 'doc', 'docx'];
const ALLOWED_ANNEX = ['pdf', 'doc', 'docx', 'zip', 'jpg', 'jpeg', 'png', 'xlsx'];

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

export function validateArticleFile(file: File, isAnnex: boolean): string | null {
  const ext = getExtension(file.name);
  const allowed = isAnnex ? ALLOWED_ANNEX : ALLOWED_MAIN;
  if (!allowed.includes(ext)) {
    return `Format non autorisé (${allowed.join(', ')}).`;
  }
  if (file.size > MAX_ARTICLE_FILE_MB * 1024 * 1024) {
    return `Fichier trop volumineux (max ${MAX_ARTICLE_FILE_MB} Mo).`;
  }
  return null;
}

function sanitizeName(fileName: string): string {
  return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function buildArticleStoragePath(userId: string, articleId: string, fileName: string): string {
  return `${userId}/${articleId}/${Date.now()}-${sanitizeName(fileName)}`;
}

export async function uploadArticleFile(
  supabase: SupabaseClient,
  userId: string,
  articleId: string,
  file: File,
  typeDocument: 'Manuscrit_Principal' | 'Annexes'
): Promise<{ data: FullArticleFile | null; error: string | null }> {
  const validation = validateArticleFile(file, typeDocument === 'Annexes');
  if (validation) return { data: null, error: validation };

  const ext = getExtension(file.name);
  const path = buildArticleStoragePath(userId, articleId, file.name);
  const { error: upErr } = await supabase.storage
    .from(ARTICLE_FILES_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || MIME[ext] || 'application/octet-stream' });

  if (upErr) return { data: null, error: upErr.message };

  const { data, error } = await supabase
    .from('full_article_files')
    .insert({
      full_article_id: articleId,
      file_url: path,
      file_name: file.name,
      file_type: ext,
      file_size_mb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      type_document: typeDocument,
    })
    .select('id, full_article_id, file_url, file_name, file_type, type_document')
    .single();

  if (error || !data) {
    await supabase.storage.from(ARTICLE_FILES_BUCKET).remove([path]);
    return { data: null, error: error?.message ?? 'Erreur enregistrement fichier.' };
  }

  return { data: data as FullArticleFile, error: null };
}

export async function deleteArticleFileRecord(
  supabase: SupabaseClient,
  file: Pick<FullArticleFile, 'id' | 'file_url'>
): Promise<string | null> {
  await supabase.storage.from(ARTICLE_FILES_BUCKET).remove([file.file_url]);
  const { error } = await supabase.from('full_article_files').delete().eq('id', file.id);
  return error?.message ?? null;
}

export async function deleteAllArticleFiles(
  supabase: SupabaseClient,
  files: Pick<FullArticleFile, 'id' | 'file_url'>[]
): Promise<void> {
  if (!files.length) return;
  await supabase.storage.from(ARTICLE_FILES_BUCKET).remove(files.map((f) => f.file_url));
  await supabase.from('full_article_files').delete().in('id', files.map((f) => f.id));
}

export async function getArticleFileSignedUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ARTICLE_FILES_BUCKET).createSignedUrl(storagePath, 3600);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export function hasMainManuscript(files: FullArticleFile[] | undefined): boolean {
  return Boolean(files?.some((f) => f.type_document === 'Manuscrit_Principal'));
}
