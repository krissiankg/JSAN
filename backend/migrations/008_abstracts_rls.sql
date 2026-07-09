-- JSAN 2025 - Migration 008
-- RLS pour co-auteurs, fichiers et lectures d'évaluations (rôle auteur)

CREATE OR REPLACE FUNCTION public.owns_abstract(abstract_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.abstracts
    WHERE id = abstract_uuid AND author_id = auth.uid()
  );
$$;

-- abstract_authors
ALTER TABLE public.abstract_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authors_manage_own_abstract_authors" ON public.abstract_authors;
CREATE POLICY "authors_manage_own_abstract_authors"
  ON public.abstract_authors FOR ALL
  USING (public.owns_abstract(abstract_id))
  WITH CHECK (public.owns_abstract(abstract_id));

DROP POLICY IF EXISTS "staff_read_abstract_authors" ON public.abstract_authors;
CREATE POLICY "staff_read_abstract_authors"
  ON public.abstract_authors FOR SELECT
  USING (public.is_reviewer_or_staff());

-- abstract_files
ALTER TABLE public.abstract_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authors_manage_own_abstract_files" ON public.abstract_files;
CREATE POLICY "authors_manage_own_abstract_files"
  ON public.abstract_files FOR ALL
  USING (public.owns_abstract(abstract_id))
  WITH CHECK (public.owns_abstract(abstract_id));

DROP POLICY IF EXISTS "staff_read_abstract_files" ON public.abstract_files;
CREATE POLICY "staff_read_abstract_files"
  ON public.abstract_files FOR SELECT
  USING (public.is_reviewer_or_staff());

-- reviews (lecture auteur + gestion évaluateurs/staff)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authors_read_own_reviews" ON public.reviews;
CREATE POLICY "authors_read_own_reviews"
  ON public.reviews FOR SELECT
  USING (public.owns_abstract(abstract_id));

DROP POLICY IF EXISTS "reviewers_manage_reviews" ON public.reviews;
CREATE POLICY "reviewers_manage_reviews"
  ON public.reviews FOR ALL
  USING (public.is_reviewer_or_staff());
