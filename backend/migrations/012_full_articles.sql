-- JSAN 2025 - Migration 012
-- Articles complets (manuscrits) liés aux résumés acceptés

CREATE TYPE full_article_status AS ENUM (
  'Brouillon',
  'Soumis',
  'En_Evaluation',
  'Accepte',
  'Rejete',
  'Publie'
);

CREATE TABLE IF NOT EXISTS public.full_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  abstract_id UUID NOT NULL REFERENCES public.abstracts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  titre VARCHAR(500) NOT NULL,
  mots_cles TEXT,
  declaration_conflit BOOLEAN DEFAULT false,
  declaration_plagiat BOOLEAN DEFAULT false,
  statut full_article_status DEFAULT 'Brouillon',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (abstract_id)
);

CREATE TABLE IF NOT EXISTS public.full_article_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_article_id UUID NOT NULL REFERENCES public.full_articles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size_mb DECIMAL(10,2),
  type_document VARCHAR(100) DEFAULT 'Manuscrit_Principal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.owns_full_article(article_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.full_articles
    WHERE id = article_uuid AND author_id = auth.uid()
  );
$$;

ALTER TABLE public.full_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.full_article_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authors_manage_own_full_articles" ON public.full_articles;
CREATE POLICY "authors_manage_own_full_articles"
  ON public.full_articles FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_all_full_articles" ON public.full_articles;
CREATE POLICY "staff_manage_all_full_articles"
  ON public.full_articles FOR ALL
  USING (public.is_event_staff());

DROP POLICY IF EXISTS "authors_manage_own_full_article_files" ON public.full_article_files;
CREATE POLICY "authors_manage_own_full_article_files"
  ON public.full_article_files FOR ALL
  USING (public.owns_full_article(full_article_id))
  WITH CHECK (public.owns_full_article(full_article_id));

DROP POLICY IF EXISTS "staff_read_full_article_files" ON public.full_article_files;
CREATE POLICY "staff_read_full_article_files"
  ON public.full_article_files FOR SELECT
  USING (public.is_event_staff());

-- Storage bucket article-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-files',
  'article-files',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "authors_upload_article_files" ON storage.objects;
CREATE POLICY "authors_upload_article_files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "authors_read_article_files" ON storage.objects;
CREATE POLICY "authors_read_article_files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'article-files'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_event_staff())
  );

DROP POLICY IF EXISTS "authors_delete_article_files" ON storage.objects;
CREATE POLICY "authors_delete_article_files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'article-files' AND (storage.foldername(name))[1] = auth.uid()::text);
