-- JSAN 2025 - Migration 021
-- Sponsors & partenaires : gestion admin + affichage public.
--
-- Modèle retenu : logos par URL (CDN, site partenaire, asset statique, etc.)
-- pour aller vite sans chantier storage dédié. Les sponsors actifs sont
-- visibles publiquement sur la page d'accueil ; la gestion reste réservée au staff.
--
-- À exécuter dans Supabase SQL Editor après les migrations précédentes.

CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(180) NOT NULL,
  niveau VARCHAR(20) NOT NULL DEFAULT 'partenaire'
    CHECK (niveau IN ('institutionnel', 'platine', 'or', 'argent', 'bronze', 'media', 'partenaire')),
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  couleur TEXT,
  ordre INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_sponsors_active_order
  ON public.event_sponsors (is_active, ordre, nom);

ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_event_sponsors" ON public.event_sponsors;
CREATE POLICY "public_read_event_sponsors"
  ON public.event_sponsors FOR SELECT
  USING (is_active = true OR public.is_event_staff());

DROP POLICY IF EXISTS "staff_manage_event_sponsors" ON public.event_sponsors;
CREATE POLICY "staff_manage_event_sponsors"
  ON public.event_sponsors FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
