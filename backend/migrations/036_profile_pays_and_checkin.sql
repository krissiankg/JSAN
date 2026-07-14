-- JSAN — Migration 036
-- 1) Pays sur les profils (stats géographiques)
-- 2) Badge / check-in jour J (token QR + horodatage)
-- 3) Helpers double-aveugle : révélation contrôlée de l'auteur aux évaluateurs

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS pays VARCHAR(100);

COMMENT ON COLUMN public.users_profile.pays IS 'Pays de résidence (libellé FR, ex. Bénin)';

ALTER TABLE public.tickets_registrations
  ADD COLUMN IF NOT EXISTS badge_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL;

UPDATE public.tickets_registrations
SET badge_token = gen_random_uuid()
WHERE badge_token IS NULL;

ALTER TABLE public.tickets_registrations
  ALTER COLUMN badge_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_registrations_badge_token_uidx
  ON public.tickets_registrations (badge_token);

CREATE INDEX IF NOT EXISTS tickets_registrations_checked_in_idx
  ON public.tickets_registrations (checked_in_at)
  WHERE checked_in_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_double_blind_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT double_aveugle_actif FROM public.events_config ORDER BY created_at DESC LIMIT 1),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.reviewer_may_see_authors(abstract_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_event_staff()
    OR (
      NOT public.is_double_blind_active()
      AND public.is_assigned_reviewer(abstract_uuid)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_submission_author_label(abstract_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  label TEXT;
BEGIN
  IF NOT public.reviewer_may_see_authors(abstract_uuid) THEN
    RETURN NULL;
  END IF;

  SELECT NULLIF(trim(both ' ' FROM coalesce(up.prenom, '') || ' ' || coalesce(up.nom, '')), '')
  INTO label
  FROM public.abstracts a
  JOIN public.users_profile up ON up.id = a.author_id
  WHERE a.id = abstract_uuid;

  RETURN label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_double_blind_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reviewer_may_see_authors(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_author_label(UUID) TO authenticated;

DROP POLICY IF EXISTS "reviewers_read_authors_when_open" ON public.abstract_authors;
CREATE POLICY "reviewers_read_authors_when_open"
  ON public.abstract_authors FOR SELECT
  USING (public.reviewer_may_see_authors(abstract_id));
