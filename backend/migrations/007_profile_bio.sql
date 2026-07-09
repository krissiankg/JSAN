-- JSAN 2025 - Migration 007
-- Présentation personnelle (bio) sur le profil utilisateur

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN public.users_profile.bio IS 'Courte présentation personnelle de l''utilisateur (quelques lignes)';
