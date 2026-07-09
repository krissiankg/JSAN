-- JSAN 2025 - Migration 014
-- Justificatifs profil (étudiant / membre SNB)

CREATE TYPE profile_document_type AS ENUM ('etudiant', 'membre');
CREATE TYPE profile_document_status AS ENUM ('En_Attente', 'Valide', 'Refuse');

CREATE TABLE IF NOT EXISTS public.profile_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  document_type profile_document_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  statut profile_document_status DEFAULT 'En_Attente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, document_type)
);

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_profile_documents" ON public.profile_documents;
CREATE POLICY "users_manage_own_profile_documents"
  ON public.profile_documents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_profile_documents" ON public.profile_documents;
CREATE POLICY "staff_manage_profile_documents"
  ON public.profile_documents FOR ALL
  USING (public.is_event_staff());

-- Storage bucket profile-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-documents',
  'profile-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "users_upload_profile_documents" ON storage.objects;
CREATE POLICY "users_upload_profile_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "users_read_profile_documents" ON storage.objects;
CREATE POLICY "users_read_profile_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_event_staff())
  );

DROP POLICY IF EXISTS "users_delete_profile_documents" ON storage.objects;
CREATE POLICY "users_delete_profile_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
