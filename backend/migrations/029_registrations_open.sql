-- JSAN — Ouverture / fermeture des inscriptions (sans maintenance globale)
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS registrations_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registrations_closed_message TEXT DEFAULT 'Les inscriptions sur la plateforme JSAN sont actuellement closes. Revenez bientôt ou contactez l''équipe organisatrice si vous avez besoin d''aide.';

-- Lecture publique du statut (sans exposer toute la config)
CREATE OR REPLACE FUNCTION public.get_registrations_status()
RETURNS TABLE (open BOOLEAN, message TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ec.registrations_open, true),
    COALESCE(
      NULLIF(TRIM(ec.registrations_closed_message), ''),
      'Les inscriptions sur la plateforme JSAN sont actuellement closes. Revenez bientôt ou contactez l''équipe organisatrice si vous avez besoin d''aide.'
    )
  FROM public.events_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_registrations_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_registrations_status() TO anon, authenticated;
