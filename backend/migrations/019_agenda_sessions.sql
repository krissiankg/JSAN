-- JSAN 2025 - Migration 019
-- Programme & Sessions : RLS + champs libres pour laisser l'équipe composer
-- le programme comme elle le souhaite (types de sessions, salles, intervenants,
-- couleurs de repérage, liens visio, résumés présentés…).
--
-- La table public.agenda_sessions existe déjà (schema.sql). On :
--   1. ajoute des colonnes libres et optionnelles ;
--   2. active la RLS : lecture publique (programme visible de tous),
--      écriture réservée au staff (organisateur / admin / superadmin).
--
-- À exécuter dans Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Colonnes additionnelles (toutes optionnelles → grande liberté)
-- ---------------------------------------------------------------------------

ALTER TABLE public.agenda_sessions
  ADD COLUMN IF NOT EXISTS type_session TEXT,        -- ex: Conférence, Atelier, Pause…
  ADD COLUMN IF NOT EXISTS intervenants TEXT,        -- texte libre (noms, affiliations)
  ADD COLUMN IF NOT EXISTS couleur TEXT,             -- code couleur de repérage (#hex)
  ADD COLUMN IF NOT EXISTS ordre INTEGER DEFAULT 0,  -- tri manuel dans un créneau
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.agenda_sessions ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte à tous (le programme d'un congrès est public).
DROP POLICY IF EXISTS "public_read_agenda" ON public.agenda_sessions;
CREATE POLICY "public_read_agenda"
  ON public.agenda_sessions FOR SELECT
  USING (true);

-- Création / modification / suppression réservées au staff.
DROP POLICY IF EXISTS "staff_manage_agenda" ON public.agenda_sessions;
CREATE POLICY "staff_manage_agenda"
  ON public.agenda_sessions FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
