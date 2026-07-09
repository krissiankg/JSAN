-- JSAN 2025 - Migration 026
-- Trace légère des e-mails de cycle de vie du compte.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS registration_email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP WITH TIME ZONE;
