-- JSAN 2025 - Migration 016
-- Durcissement RLS du peer review.
--
-- Problème corrigé : jusqu'ici tout 'pair_valide' pouvait lire ET écrire
-- TOUS les résumés et TOUTES les évaluations (policies basées sur
-- public.is_reviewer_or_staff()). On restreint désormais chaque évaluateur
-- aux seules soumissions qui lui sont assignées (présence d'une ligne dans
-- public.reviews avec reviewer_id = auth.uid()), et à ses propres évaluations.
--
-- Les comptes staff (organisateur / admin / superadmin) conservent un accès
-- complet via public.is_event_staff().
--
-- À exécuter dans Supabase SQL Editor après les migrations 008 et 012.

-- ---------------------------------------------------------------------------
-- 1. Helpers (SECURITY DEFINER → contournent RLS, pas de récursion)
-- ---------------------------------------------------------------------------

-- L'utilisateur courant est-il assigné comme évaluateur de ce résumé ?
CREATE OR REPLACE FUNCTION public.is_assigned_reviewer(abstract_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE abstract_id = abstract_uuid
      AND reviewer_id = auth.uid()
  );
$$;

-- L'utilisateur courant peut-il lire ce fichier de résumé (storage) ?
-- file_url stocké == chemin storage (storage.objects.name).
CREATE OR REPLACE FUNCTION public.reviewer_can_read_abstract_file(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.abstract_files af
    JOIN public.reviews r ON r.abstract_id = af.abstract_id
    WHERE af.file_url = object_name
      AND r.reviewer_id = auth.uid()
  );
$$;

-- L'utilisateur courant peut-il lire ce fichier de manuscrit (storage) ?
CREATE OR REPLACE FUNCTION public.reviewer_can_read_article_file(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.full_article_files faf
    JOIN public.full_articles fa ON fa.id = faf.full_article_id
    JOIN public.reviews r ON r.abstract_id = fa.abstract_id
    WHERE faf.file_url = object_name
      AND r.reviewer_id = auth.uid()
  );
$$;

-- Accès lecture aux fichiers de manuscrit pour un évaluateur assigné
-- (full_article_files n'a que full_article_id → on remonte au résumé parent).
CREATE OR REPLACE FUNCTION public.is_assigned_reviewer_for_article(article_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.full_articles fa
    JOIN public.reviews r ON r.abstract_id = fa.abstract_id
    WHERE fa.id = article_uuid
      AND r.reviewer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. abstracts : staff complet + auteur propriétaire + évaluateur assigné (SELECT)
-- ---------------------------------------------------------------------------

-- Remplace l'ancienne policy FOR ALL qui ouvrait abstracts à tous les pair_valide.
DROP POLICY IF EXISTS "staff_manage_all_abstracts" ON public.abstracts;
CREATE POLICY "staff_manage_all_abstracts"
  ON public.abstracts FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

DROP POLICY IF EXISTS "reviewers_read_assigned_abstracts" ON public.abstracts;
CREATE POLICY "reviewers_read_assigned_abstracts"
  ON public.abstracts FOR SELECT
  USING (public.is_assigned_reviewer(id));

-- ---------------------------------------------------------------------------
-- 3. reviews : staff complet + auteur (lecture) + évaluateur (ses lignes)
-- ---------------------------------------------------------------------------

-- Ancienne policy trop large (tout pair_valide gérait toutes les reviews).
DROP POLICY IF EXISTS "reviewers_manage_reviews" ON public.reviews;

DROP POLICY IF EXISTS "staff_manage_all_reviews" ON public.reviews;
CREATE POLICY "staff_manage_all_reviews"
  ON public.reviews FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

-- Un évaluateur ne voit que SES évaluations (préserve le double-aveugle).
DROP POLICY IF EXISTS "reviewers_read_own_reviews" ON public.reviews;
CREATE POLICY "reviewers_read_own_reviews"
  ON public.reviews FOR SELECT
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviewers_insert_own_reviews" ON public.reviews;
CREATE POLICY "reviewers_insert_own_reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviewers_update_own_reviews" ON public.reviews;
CREATE POLICY "reviewers_update_own_reviews"
  ON public.reviews FOR UPDATE
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- NB : suppression d'une review réservée au staff (désassignation).
-- authors_read_own_reviews (migration 008) reste inchangée.

-- ---------------------------------------------------------------------------
-- 4. abstract_authors : staff uniquement (double-aveugle : pas d'identité auteur)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_read_abstract_authors" ON public.abstract_authors;
CREATE POLICY "staff_read_abstract_authors"
  ON public.abstract_authors FOR SELECT
  USING (public.is_event_staff());

-- ---------------------------------------------------------------------------
-- 5. abstract_files : staff + évaluateur assigné (SELECT)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_read_abstract_files" ON public.abstract_files;
CREATE POLICY "staff_read_abstract_files"
  ON public.abstract_files FOR SELECT
  USING (public.is_event_staff());

DROP POLICY IF EXISTS "reviewers_read_assigned_abstract_files" ON public.abstract_files;
CREATE POLICY "reviewers_read_assigned_abstract_files"
  ON public.abstract_files FOR SELECT
  USING (public.is_assigned_reviewer(abstract_id));

-- ---------------------------------------------------------------------------
-- 6. full_articles : staff + auteur + évaluateur assigné (SELECT)
--    (corrige aussi un manque : les pair_valide n'avaient AUCUN accès)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "reviewers_read_assigned_full_articles" ON public.full_articles;
CREATE POLICY "reviewers_read_assigned_full_articles"
  ON public.full_articles FOR SELECT
  USING (public.is_assigned_reviewer(abstract_id));

DROP POLICY IF EXISTS "reviewers_read_assigned_full_article_files" ON public.full_article_files;
CREATE POLICY "reviewers_read_assigned_full_article_files"
  ON public.full_article_files FOR SELECT
  USING (public.is_assigned_reviewer_for_article(full_article_id));

-- ---------------------------------------------------------------------------
-- 7. Storage : remplace l'accès « tout évaluateur » par « évaluateur assigné »
-- ---------------------------------------------------------------------------

-- Bucket abstract-files (migration 009)
DROP POLICY IF EXISTS "authors_read_abstract_files" ON storage.objects;
CREATE POLICY "authors_read_abstract_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'abstract-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_event_staff()
      OR public.reviewer_can_read_abstract_file(name)
    )
  );

-- Bucket article-files (migration 012)
DROP POLICY IF EXISTS "authors_read_article_files" ON storage.objects;
CREATE POLICY "authors_read_article_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'article-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_event_staff()
      OR public.reviewer_can_read_article_file(name)
    )
  );
