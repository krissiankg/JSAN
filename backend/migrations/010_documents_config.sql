-- JSAN 2025 - Migration 010
-- Métadonnées documents officiels (fichier uploadé par organisateur / super admin)

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS documents_config JSONB;

UPDATE public.events_config
SET documents_config = COALESCE(documents_config, '{}'::jsonb) || '{
  "instructions_resume": {
    "title": "Guide de soumission des résumés",
    "description": "Consignes officielles JSAN — document publié par l''organisateur (PDF ou Word)"
  }
}'::jsonb
WHERE documents_config IS NULL OR NOT (documents_config ? 'instructions_resume');

-- Retirer d''éventuelles références HTML statiques
UPDATE public.events_config
SET documents_config = jsonb_set(
  COALESCE(documents_config, '{}'::jsonb),
  '{instructions_resume}',
  (documents_config->'instructions_resume') - 'url' - 'preview_url' - 'file_name' - 'format' - 'version'
)
WHERE documents_config->'instructions_resume'->>'url' LIKE '%.html';
