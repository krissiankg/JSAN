-- JSAN 2025 - Migration 024
-- Attestations personnalisées avec ouverture/fermeture globale des téléchargements.
--
-- Le staff crée les attestations pour chaque utilisateur. Les utilisateurs ne
-- peuvent les lire/télécharger que lorsque le staff ouvre la période de
-- téléchargement via events_config.attestations_enabled.
--
-- À exécuter dans Supabase SQL Editor après les migrations précédentes.

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS attestations_enabled BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_attestations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  attestation_type VARCHAR(30) NOT NULL DEFAULT 'autre'
    CHECK (attestation_type IN ('participation', 'organisation', 'communication', 'evaluation', 'publication', 'merite', 'autre')),
  titre VARCHAR(255) NOT NULL DEFAULT 'ATTESTATION',
  designation VARCHAR(255), -- ex: "DE MERITE"
  recipient_label VARCHAR(20) DEFAULT 'Monsieur',
  recipient_name VARCHAR(255) NOT NULL,
  intro_text TEXT DEFAULT 'Cette attestation certifie que:',
  body_text TEXT NOT NULL,
  footer_text TEXT DEFAULT 'Pour servir et valoir ce que de droit.',
  reference_code VARCHAR(120),
  issued_on DATE DEFAULT CURRENT_DATE,
  signatory_left_name VARCHAR(255),
  signatory_left_title TEXT,
  signatory_right_name VARCHAR(255),
  signatory_right_title TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_attestations_user_created
  ON public.user_attestations (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.attestations_download_open()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT attestations_enabled FROM public.events_config ORDER BY created_at DESC LIMIT 1),
    false
  );
$$;

ALTER TABLE public.user_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_open_own_attestations" ON public.user_attestations;
CREATE POLICY "users_read_open_own_attestations"
  ON public.user_attestations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND is_active = true
    AND public.attestations_download_open()
  );

DROP POLICY IF EXISTS "staff_manage_all_attestations" ON public.user_attestations;
CREATE POLICY "staff_manage_all_attestations"
  ON public.user_attestations FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
