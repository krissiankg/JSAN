-- JSAN 2025 - Migration 035
-- Comité d'organisation : membres, liaison comptes plateforme, contact messagerie.
--
-- À exécuter dans Supabase SQL Editor après les migrations précédentes.

CREATE TABLE IF NOT EXISTS public.committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section TEXT NOT NULL CHECK (section IN ('bureau', 'commission', 'ressource')),
  commission TEXT,
  title TEXT NOT NULL,
  full_name TEXT NOT NULL,
  user_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  is_messaging_contact BOOLEAN NOT NULL DEFAULT false,
  ordre INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT committee_commission_required CHECK (
    (section = 'commission' AND commission IS NOT NULL AND length(trim(commission)) > 0)
    OR (section <> 'commission' AND commission IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_committee_members_active_order
  ON public.committee_members (is_active, section, ordre, full_name);

CREATE INDEX IF NOT EXISTS idx_committee_members_user
  ON public.committee_members (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_committee_one_messaging_contact
  ON public.committee_members (is_messaging_contact)
  WHERE is_messaging_contact = true AND is_active = true;

ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_committee_members" ON public.committee_members;
CREATE POLICY "authenticated_read_committee_members"
  ON public.committee_members FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_event_staff());

DROP POLICY IF EXISTS "staff_manage_committee_members" ON public.committee_members;
CREATE POLICY "staff_manage_committee_members"
  ON public.committee_members FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

-- Seed initial (comité d'organisation JSAN — document officiel)
INSERT INTO public.committee_members (section, commission, title, full_name, is_messaging_contact, ordre)
SELECT * FROM (VALUES
  ('bureau'::text, NULL::text, 'Présidente'::text, 'AZANDJEME Colette'::text, false, 10),
  ('bureau', NULL, 'Vice-président', 'HOUHOUIGAN Harold', false, 20),
  ('bureau', NULL, 'Secrétaire', 'HONFO Fernande', true, 30),
  ('bureau', NULL, 'Président SNB', 'MITCHIKPE Evariste', false, 40),
  ('bureau', NULL, 'Vice-présidente SNB', 'AGUEH Victoire', false, 50),
  ('ressource', NULL, 'Personne ressource', 'HINKATI Alain', false, 10),
  ('ressource', NULL, 'Personne ressource', 'MONGBO Rock', false, 20),
  ('ressource', NULL, 'Personne ressource', 'ACAKPO Alfred', false, 30),
  ('ressource', NULL, 'Personne ressource', 'GUEZO-MEVO Blaise', false, 40),
  ('ressource', NULL, 'Personne ressource', 'AMIDOU Salmane', false, 50),
  ('commission', 'Gestion scientifique', 'Présidente', 'FANOU Nadia', false, 10),
  ('commission', 'Gestion scientifique', 'Vice-présidente', 'TONON Brigitte', false, 20),
  ('commission', 'Gestion scientifique', 'Secrétaire', 'DARBOUX Joachim', false, 30),
  ('commission', 'Secrétariat', 'Présidente', 'HONFO Fernande', false, 10),
  ('commission', 'Secrétariat', 'Vice-présidente', 'METONNOU Clémence', false, 20),
  ('commission', 'Secrétariat', 'Secrétaire', 'FANOU Vanessa', false, 30),
  ('commission', 'Communication et Marketing', 'Président', 'BODJRENOU Sam', false, 10),
  ('commission', 'Communication et Marketing', 'Vice-présidente', 'DJOSSINOU Diane', false, 20),
  ('commission', 'Communication et Marketing', 'Secrétaire', 'AGOSSADOU Donnelle', false, 30),
  ('commission', 'Mobilisation des ressources', 'Président', 'AMOUSSA Waliou', false, 10),
  ('commission', 'Mobilisation des ressources', 'Vice-président', 'SOSSA Charles', false, 20),
  ('commission', 'Mobilisation des ressources', 'Secrétaire', 'LAWANI Jeanine', false, 30),
  ('commission', 'Logistique', 'Président', 'MADODE Yann', false, 10),
  ('commission', 'Logistique', 'Vice-présidente', 'MITCHODIGNI Irène', false, 20),
  ('commission', 'Logistique', 'Secrétaire', 'HOUENASSI Eve', false, 30),
  ('commission', 'Finance', 'Présidente', 'CHADARE Flora', false, 10),
  ('commission', 'Finance', 'Vice-présidente', 'ALIHONOU Florence', false, 20),
  ('commission', 'Finance', 'Secrétaire', 'DAMADOU Océanne', false, 30)
) AS v(section, commission, title, full_name, is_messaging_contact, ordre)
WHERE NOT EXISTS (SELECT 1 FROM public.committee_members LIMIT 1);
