-- JSAN 2025 - Migration 025
-- Modèles d'e-mails éditables par le staff.
--
-- Stockage souple en JSONB dans events_config afin d'éviter une table trop rigide
-- pour des gabarits qui évolueront encore (inscription, bienvenue, annonces,
-- rappels de session, décisions scientifiques, paiements, attestations...).

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS email_templates JSONB DEFAULT '{}'::jsonb;
