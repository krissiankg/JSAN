-- JSAN 2025 - Migration 031
-- RPC fiables pour lire/écrire attestations_enabled + rechargement du cache API.
--
-- À exécuter dans Supabase SQL Editor après la migration 024.

-- Ligne events_config minimale si la table est vide
INSERT INTO public.events_config (
  nom_evenement,
  date_debut,
  date_fin,
  themes_disponibles,
  types_presentation,
  upload_rules
)
SELECT
  'JSAN 2025 — 1ère Édition',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '5 days',
  '["Nutrition clinique", "Sécurité sanitaire", "Nutrition infantile", "Santé publique"]'::JSONB,
  '["Oral", "Poster"]'::JSONB,
  '{"max_files": 3, "max_size_mb": 10}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.events_config);

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS attestations_enabled BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_attestations_settings()
RETURNS TABLE (config_id UUID, attestations_enabled BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ec.id, COALESCE(ec.attestations_enabled, false)
  FROM public.events_config ec
  ORDER BY ec.created_at DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_attestations_enabled(p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_event_staff() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT ec.id INTO v_id
  FROM public.events_config ec
  ORDER BY ec.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Aucune configuration événement (events_config)';
  END IF;

  UPDATE public.events_config
  SET attestations_enabled = p_enabled
  WHERE id = v_id;

  RETURN p_enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attestations_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_attestations_enabled(BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
