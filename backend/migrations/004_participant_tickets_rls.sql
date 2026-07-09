-- JSAN 2025 - Migration 004
-- Billetterie participant : RLS + config événement par défaut

-- 1. RLS sur tickets_registrations
ALTER TABLE public.tickets_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_tickets" ON public.tickets_registrations;
CREATE POLICY "users_read_own_tickets"
  ON public.tickets_registrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_tickets" ON public.tickets_registrations;
CREATE POLICY "users_insert_own_tickets"
  ON public.tickets_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_manage_all_tickets" ON public.tickets_registrations;
CREATE POLICY "staff_manage_all_tickets"
  ON public.tickets_registrations FOR ALL
  USING (public.is_event_staff());

-- 2. Configuration événement JSAN 2025 (si vide)
INSERT INTO public.events_config (
  nom_evenement,
  date_debut,
  date_fin,
  themes_disponibles,
  types_presentation,
  upload_rules
)
SELECT
  'JSAN 2025 — 1ère Édition',
  '2025-06-10'::DATE,
  '2025-06-14'::DATE,
  '["Nutrition clinique", "Sécurité sanitaire", "Nutrition infantile", "Santé publique"]'::JSONB,
  '["Oral", "Poster"]'::JSONB,
  '{"max_files": 3, "max_size_mb": 10}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.events_config);
