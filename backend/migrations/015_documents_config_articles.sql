-- JSAN 2025 - Migration 015
-- Métadonnées guide articles complets (documents_config.instructions_article)

UPDATE public.events_config
SET documents_config = COALESCE(documents_config, '{}'::jsonb) || '{
  "instructions_article": {
    "title": "Guide de soumission des articles complets",
    "description": "Consignes officielles JSAN pour les manuscrits — document publié par l''organisateur (PDF ou Word)"
  }
}'::jsonb
WHERE documents_config IS NULL OR NOT (documents_config ? 'instructions_article');
