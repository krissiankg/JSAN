import type { SupabaseClient } from '@supabase/supabase-js';
import { FULL_ARTICLE_SELECT, normalizeFullArticle, type FullArticle } from '@/lib/full-articles';

export const LIBRARY_BUCKET = 'library-documents';
export const MAX_LIBRARY_FILE_MB = 25;

export type LibraryCategory = 'actes' | 'article' | 'archive' | 'guide' | 'rapport' | 'autre';

export interface LibraryDocument {
  id: string;
  titre: string;
  auteurs: string | null;
  categorie: LibraryCategory;
  annee: number | null;
  description: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  is_active: boolean;
  is_featured: boolean;
  ordre: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface LibraryDocumentInput {
  titre: string;
  auteurs?: string | null;
  categorie: LibraryCategory;
  annee?: number | null;
  description?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  ordre?: number | null;
}

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  actes: 'Actes',
  article: 'Article',
  archive: 'Archive',
  guide: 'Guide',
  rapport: 'Rapport',
  autre: 'Autre',
};

export const LIBRARY_CATEGORY_ORDER: LibraryCategory[] = [
  'actes',
  'article',
  'archive',
  'guide',
  'rapport',
  'autre',
];

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
};

const ALLOWED_EXTENSIONS = Object.keys(MIME);
const LIBRARY_SELECT =
  'id, titre, auteurs, categorie, annee, description, file_path, file_name, file_type, is_active, is_featured, ordre, created_at, updated_at';

function sanitizeName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function getExt(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function validateLibraryFile(file: File): string | null {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Format non autorisé (${ALLOWED_EXTENSIONS.join(', ')}).`;
  }
  if (file.size > MAX_LIBRARY_FILE_MB * 1024 * 1024) {
    return `Fichier trop volumineux (max ${MAX_LIBRARY_FILE_MB} Mo).`;
  }
  return null;
}

export function buildLibraryStoragePath(category: LibraryCategory, title: string, fileName: string): string {
  return `${category}/${sanitizeName(title || 'document')}/${Date.now()}-${sanitizeName(fileName)}`;
}

export async function uploadLibraryFile(
  supabase: SupabaseClient,
  category: LibraryCategory,
  title: string,
  file: File,
  existingPath?: string | null
): Promise<{ filePath: string | null; fileName: string; fileType: string | null; error: string | null }> {
  const validation = validateLibraryFile(file);
  if (validation) return { filePath: null, fileName: file.name, fileType: null, error: validation };

  if (existingPath) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([existingPath]);
  }

  const ext = getExt(file.name);
  const filePath = buildLibraryStoragePath(category, title, file.name);
  const { error } = await supabase.storage
    .from(LIBRARY_BUCKET)
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type || MIME[ext] || 'application/octet-stream',
    });

  return error
    ? { filePath: null, fileName: file.name, fileType: ext || null, error: error.message }
    : { filePath, fileName: file.name, fileType: ext || null, error: null };
}

export async function removeLibraryFile(
  supabase: SupabaseClient,
  filePath: string | null | undefined
): Promise<string | null> {
  if (!filePath) return null;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).remove([filePath]);
  return error?.message ?? null;
}

export function getLibraryFileUrl(supabase: SupabaseClient, filePath: string): string {
  return supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(filePath).data.publicUrl;
}

function normalizeLibraryInput(input: LibraryDocumentInput): Record<string, unknown> {
  return {
    titre: input.titre.trim(),
    auteurs: cleanText(input.auteurs),
    categorie: input.categorie,
    annee: input.annee ?? null,
    description: cleanText(input.description),
    file_path: input.file_path,
    file_name: input.file_name,
    file_type: input.file_type,
    is_active: input.is_active ?? true,
    is_featured: input.is_featured ?? false,
    ordre: input.ordre ?? 0,
  };
}

export async function fetchLibraryDocuments(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<LibraryDocument[]> {
  let query = supabase
    .from('library_documents')
    .select(LIBRARY_SELECT)
    .order('is_featured', { ascending: false })
    .order('ordre', { ascending: true })
    .order('annee', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data } = await query;
  return (data ?? []) as LibraryDocument[];
}

export async function createLibraryDocument(
  supabase: SupabaseClient,
  input: LibraryDocumentInput
): Promise<string | null> {
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  if (!input.file_path || !input.file_name) return 'Le document est obligatoire.';
  const { error } = await supabase.from('library_documents').insert(normalizeLibraryInput(input));
  return error ? error.message : null;
}

export async function updateLibraryDocument(
  supabase: SupabaseClient,
  id: string,
  input: LibraryDocumentInput
): Promise<string | null> {
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  if (!input.file_path || !input.file_name) return 'Le document est obligatoire.';
  const { error } = await supabase
    .from('library_documents')
    .update({ ...normalizeLibraryInput(input), updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteLibraryDocument(
  supabase: SupabaseClient,
  doc: Pick<LibraryDocument, 'id' | 'file_path'>
): Promise<string | null> {
  await removeLibraryFile(supabase, doc.file_path);
  const { error } = await supabase.from('library_documents').delete().eq('id', doc.id);
  return error?.message ?? null;
}

export async function fetchPublishedLibraryArticles(
  supabase: SupabaseClient
): Promise<FullArticle[]> {
  const { data } = await supabase
    .from('full_articles')
    .select(FULL_ARTICLE_SELECT)
    .eq('statut', 'Publie')
    .order('updated_at', { ascending: false });
  return (data ?? []).map((row) => normalizeFullArticle(row));
}

export function groupLibraryByCategory(documents: LibraryDocument[]): Array<{
  category: LibraryCategory;
  label: string;
  items: LibraryDocument[];
}> {
  return LIBRARY_CATEGORY_ORDER.map((category) => ({
    category,
    label: LIBRARY_CATEGORY_LABELS[category],
    items: documents.filter((d) => d.categorie === category),
  })).filter((group) => group.items.length > 0);
}
