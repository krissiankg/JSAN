import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbUserRole } from '@/lib/roles';
import { notifyJustificatifApproved, notifyJustificatifRejected } from '@/lib/notifications';

export const PROFILE_DOCUMENTS_BUCKET = 'profile-documents';
export const MAX_PROFILE_DOC_MB = 10;

export type ProfileDocumentType = 'etudiant' | 'membre';
export type ProfileDocumentStatus = 'En_Attente' | 'Valide' | 'Refuse';

export interface ProfileDocument {
  id: string;
  user_id: string;
  document_type: ProfileDocumentType;
  file_url: string;
  file_name: string;
  file_type: string | null;
  statut: ProfileDocumentStatus;
  created_at: string;
  updated_at: string;
}

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export function profileDocStatusLabel(
  doc: ProfileDocument | null | undefined,
  isVerified: boolean
): string {
  if (isVerified) return '✓ Validé';
  if (!doc) return 'Non fourni';
  if (doc.statut === 'En_Attente') return '⏳ En attente';
  if (doc.statut === 'Refuse') return '✗ Refusé';
  return 'Non fourni';
}

export function profileDocBadgeClass(
  doc: ProfileDocument | null | undefined,
  isVerified: boolean
): 'approved' | 'pending' | 'missing' | 'rejected' {
  if (isVerified) return 'approved';
  if (doc?.statut === 'En_Attente') return 'pending';
  if (doc?.statut === 'Refuse') return 'rejected';
  return 'missing';
}

export function validateProfileDocumentFile(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Format non autorisé (${ALLOWED_EXTENSIONS.join(', ')}).`;
  }
  if (file.size > MAX_PROFILE_DOC_MB * 1024 * 1024) {
    return `Fichier trop volumineux (max ${MAX_PROFILE_DOC_MB} Mo).`;
  }
  return null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function buildProfileDocStoragePath(userId: string, docType: ProfileDocumentType, fileName: string): string {
  return `${userId}/${docType}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export async function fetchProfileDocuments(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileDocument[]> {
  const { data, error } = await supabase
    .from('profile_documents')
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileDocument[];
}

export async function uploadProfileDocument(
  supabase: SupabaseClient,
  userId: string,
  docType: ProfileDocumentType,
  file: File,
  existing?: ProfileDocument | null
): Promise<{ data: ProfileDocument | null; error: string | null }> {
  const validation = validateProfileDocumentFile(file);
  if (validation) return { data: null, error: validation };

  if (existing?.file_url) {
    await supabase.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([existing.file_url]);
  }

  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const storagePath = buildProfileDocStoragePath(userId, docType, file.name);

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || MIME[ext] || 'application/octet-stream' });

  if (uploadError) return { data: null, error: uploadError.message };

  const row = {
    user_id: userId,
    document_type: docType,
    file_url: storagePath,
    file_name: file.name,
    file_type: ext,
    statut: 'En_Attente' as const,
    updated_at: new Date().toISOString(),
  };

  const { data, error: dbError } = await supabase
    .from('profile_documents')
    .upsert(row, { onConflict: 'user_id,document_type' })
    .select('*')
    .single();

  if (dbError || !data) {
    await supabase.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([storagePath]);
    return { data: null, error: dbError?.message ?? 'Erreur enregistrement.' };
  }

  const verifyField = docType === 'etudiant' ? 'is_student_verified' : 'is_member_verified';
  await supabase.from('users_profile').update({ [verifyField]: false }).eq('id', userId);

  return { data: data as ProfileDocument, error: null };
}

export async function deleteProfileDocument(
  supabase: SupabaseClient,
  userId: string,
  doc: ProfileDocument
): Promise<string | null> {
  await supabase.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([doc.file_url]);
  const { error } = await supabase.from('profile_documents').delete().eq('id', doc.id);

  if (error) return error.message;

  const verifyField = doc.document_type === 'etudiant' ? 'is_student_verified' : 'is_member_verified';
  await supabase.from('users_profile').update({ [verifyField]: false }).eq('id', userId);
  return null;
}

export async function getProfileDocumentSignedUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export function formatProfileDocDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function profileDocumentTypeLabel(type: ProfileDocumentType): string {
  return type === 'etudiant' ? 'Justificatif étudiant' : 'Justificatif membre SNB';
}

export interface PendingVerificationRow {
  document: ProfileDocument;
  user: {
    id: string;
    nom: string | null;
    prenom: string | null;
    role: DbUserRole;
    created_at: string;
    telephone: string | null;
  };
}

export async function fetchPendingProfileDocuments(
  supabase: SupabaseClient
): Promise<PendingVerificationRow[]> {
  const { data, error } = await supabase
    .from('profile_documents')
    .select(`
      *,
      user:users_profile!profile_documents_user_id_fkey (
        id, nom, prenom, role, created_at, telephone
      )
    `)
    .eq('statut', 'En_Attente')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.user)
    .map((row) => ({
      document: {
        id: row.id,
        user_id: row.user_id,
        document_type: row.document_type,
        file_url: row.file_url,
        file_name: row.file_name,
        file_type: row.file_type,
        statut: row.statut,
        created_at: row.created_at,
        updated_at: row.updated_at,
      } as ProfileDocument,
      user: row.user as PendingVerificationRow['user'],
    }));
}

export async function approveProfileDocument(
  supabase: SupabaseClient,
  doc: ProfileDocument
): Promise<string | null> {
  const { error: docError } = await supabase
    .from('profile_documents')
    .update({ statut: 'Valide', updated_at: new Date().toISOString() })
    .eq('id', doc.id);

  if (docError) return docError.message;

  const verifyField = doc.document_type === 'etudiant' ? 'is_student_verified' : 'is_member_verified';
  const { error: profileError } = await supabase
    .from('users_profile')
    .update({ [verifyField]: true })
    .eq('id', doc.user_id);

  if (profileError) return profileError.message;

  await notifyJustificatifApproved(supabase, doc.user_id, doc.document_type);

  return null;
}

export async function rejectProfileDocument(
  supabase: SupabaseClient,
  doc: ProfileDocument
): Promise<string | null> {
  const { error: docError } = await supabase
    .from('profile_documents')
    .update({ statut: 'Refuse', updated_at: new Date().toISOString() })
    .eq('id', doc.id);

  if (docError) return docError.message;

  const verifyField = doc.document_type === 'etudiant' ? 'is_student_verified' : 'is_member_verified';
  const { error: profileError } = await supabase
    .from('users_profile')
    .update({ [verifyField]: false })
    .eq('id', doc.user_id);

  if (profileError) return profileError.message;

  await notifyJustificatifRejected(supabase, doc.user_id, doc.document_type);

  return null;
}
