-- JSAN — Images du blog (couverture + contenu éditeur riche)
-- À exécuter dans Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  10485760, -- 10 Mo
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_blog_images" ON storage.objects;
CREATE POLICY "public_read_blog_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "staff_manage_blog_images" ON storage.objects;
CREATE POLICY "staff_manage_blog_images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'blog-images' AND public.is_event_staff())
  WITH CHECK (bucket_id = 'blog-images' AND public.is_event_staff());
