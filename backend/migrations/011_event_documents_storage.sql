-- JSAN 2025 - Migration 011
-- Bucket Storage pour documents événement (guides auteurs PDF / Word)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-documents',
  'event-documents',
  false,
  20971520, -- 20 Mo
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture : tout utilisateur authentifié (auteurs téléchargent le guide)
DROP POLICY IF EXISTS "authenticated_read_event_documents" ON storage.objects;
CREATE POLICY "authenticated_read_event_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'event-documents');

-- Gestion : organisateur et super admin uniquement
DROP POLICY IF EXISTS "staff_manage_event_documents" ON storage.objects;
CREATE POLICY "staff_manage_event_documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'event-documents' AND public.is_event_staff())
  WITH CHECK (bucket_id = 'event-documents' AND public.is_event_staff());
