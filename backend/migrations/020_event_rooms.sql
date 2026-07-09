-- JSAN 2025 - Migration 020
-- Salles (physiques, virtuelles, hybrides) + lien optionnel vers une salle
-- depuis agenda_sessions.
--
-- Sessions parallèles : plusieurs sessions au même créneau = salles différentes,
-- chacune avec son propre lien visio (Zoom, Meet, Teams, Jitsi…).
--
-- À exécuter dans Supabase SQL Editor après 019_agenda_sessions.sql.

-- ---------------------------------------------------------------------------
-- 1. Table event_rooms
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'physique'
    CHECK (type IN ('physique', 'virtuelle', 'hybride')),
  capacite INTEGER,
  lieu TEXT,
  visio_provider VARCHAR(30)
    CHECK (visio_provider IS NULL OR visio_provider IN ('zoom', 'meet', 'teams', 'jitsi', 'autre')),
  visio_url TEXT,
  notes TEXT,
  couleur TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Lien session → salle (optionnel ; salle_nom reste pour affichage / repli)
-- ---------------------------------------------------------------------------

ALTER TABLE public.agenda_sessions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.event_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_sessions_room_id
  ON public.agenda_sessions (room_id);

CREATE INDEX IF NOT EXISTS idx_agenda_sessions_date_heure
  ON public.agenda_sessions (date_session, heure_debut);

-- ---------------------------------------------------------------------------
-- 3. RLS event_rooms (lecture publique, écriture staff)
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_event_rooms" ON public.event_rooms;
CREATE POLICY "public_read_event_rooms"
  ON public.event_rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "staff_manage_event_rooms" ON public.event_rooms;
CREATE POLICY "staff_manage_event_rooms"
  ON public.event_rooms FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
