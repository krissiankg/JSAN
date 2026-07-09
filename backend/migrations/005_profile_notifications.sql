-- JSAN 2025 - Migration 005
-- Préférences de notification sur le profil utilisateur

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "email_evenement": true,
    "email_billetterie": true,
    "email_messagerie": true,
    "email_soumissions": false
  }'::JSONB;
