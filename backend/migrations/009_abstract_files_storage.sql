-- JSAN 2025 - Migration 009
-- Bucket Storage pour les fichiers de résumés (abstract_files)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'abstract-files',
  'abstract-files',
  false,
  10485760, -- 10 Mo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Extensions autorisées dans events_config (si absentes)
UPDATE public.events_config
SET upload_rules = COALESCE(upload_rules, '{}'::jsonb) || '{"allowed_extensions": ["pdf", "jpg", "jpeg", "png", "doc", "docx"]}'::jsonb
WHERE upload_rules IS NULL OR NOT (upload_rules ? 'allowed_extensions');

-- Policies Storage : chemin {author_id}/{abstract_id}/{fichier}
DROP POLICY IF EXISTS "authors_upload_abstract_files" ON storage.objects;
CREATE POLICY "authors_upload_abstract_files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'abstract-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "authors_read_abstract_files" ON storage.objects;
CREATE POLICY "authors_read_abstract_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'abstract-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_reviewer_or_staff()
    )
  );

DROP POLICY IF EXISTS "authors_delete_abstract_files" ON storage.objects;
CREATE POLICY "authors_delete_abstract_files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'abstract-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
