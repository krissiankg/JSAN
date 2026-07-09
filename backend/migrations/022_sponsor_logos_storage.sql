-- JSAN 2025 - Migration 022
-- Logos sponsors : bucket storage public + colonne logo_path.
--
-- Les anciens enregistrements `logo_url` restent compatibles en secours.
-- Les nouveaux logos sont uploadés dans Supabase Storage, bucket public.
--
-- À exécuter dans Supabase SQL Editor après 021_event_sponsors.sql.

ALTER TABLE public.event_sponsors
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880, -- 5 Mo
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_sponsor_logos" ON storage.objects;
CREATE POLICY "public_read_sponsor_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sponsor-logos');

DROP POLICY IF EXISTS "staff_manage_sponsor_logos" ON storage.objects;
CREATE POLICY "staff_manage_sponsor_logos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'sponsor-logos' AND public.is_event_staff())
  WITH CHECK (bucket_id = 'sponsor-logos' AND public.is_event_staff());
