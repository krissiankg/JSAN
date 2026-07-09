-- JSAN 2025 - Migration 023
-- Bibliothèque scientifique : anciens documents / actes / ressources partagées.
--
-- Objectif :
--   1. permettre à l'équipe d'uploader d'anciens documents ;
--   2. les rendre consultables par les utilisateurs connectés ;
--   3. garder la gestion réservée au staff.
--
-- À exécuter dans Supabase SQL Editor après les migrations précédentes.

CREATE TABLE IF NOT EXISTS public.library_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titre VARCHAR(255) NOT NULL,
  auteurs TEXT,
  categorie VARCHAR(20) NOT NULL DEFAULT 'archive'
    CHECK (categorie IN ('actes', 'article', 'archive', 'guide', 'rapport', 'autre')),
  annee INTEGER,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_documents_active_order
  ON public.library_documents (is_active, categorie, ordre, annee DESC);

ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_library_documents" ON public.library_documents;
CREATE POLICY "authenticated_read_library_documents"
  ON public.library_documents FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_event_staff());

DROP POLICY IF EXISTS "staff_manage_library_documents" ON public.library_documents;
CREATE POLICY "staff_manage_library_documents"
  ON public.library_documents FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'library-documents',
  'library-documents',
  true,
  26214400, -- 25 Mo
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_library_storage" ON storage.objects;
CREATE POLICY "public_read_library_storage"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'library-documents');

DROP POLICY IF EXISTS "staff_manage_library_storage" ON storage.objects;
CREATE POLICY "staff_manage_library_storage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'library-documents' AND public.is_event_staff())
  WITH CHECK (bucket_id = 'library-documents' AND public.is_event_staff());
