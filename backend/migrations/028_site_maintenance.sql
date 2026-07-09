-- JSAN — Mode maintenance (page publique + contournement staff)
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'La plateforme JSAN est en cours de préparation. Nous revenons très bientôt.';

-- Lecture publique du statut maintenance (sans exposer toute la config)
CREATE OR REPLACE FUNCTION public.get_site_maintenance()
RETURNS TABLE (enabled BOOLEAN, message TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ec.maintenance_mode, false),
    COALESCE(
      NULLIF(TRIM(ec.maintenance_message), ''),
      'La plateforme JSAN est en cours de préparation. Nous revenons très bientôt.'
    )
  FROM public.events_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_site_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_maintenance() TO anon, authenticated;
