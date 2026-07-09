-- JSAN 2025 - Migration 006
-- Notifications internes (cloche du dashboard)

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, is_read)
  WHERE is_read = false;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_notifications" ON public.user_notifications;
CREATE POLICY "users_read_own_notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_notifications" ON public.user_notifications;
CREATE POLICY "users_update_own_notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_insert_notifications" ON public.user_notifications;
CREATE POLICY "staff_insert_notifications"
  ON public.user_notifications FOR INSERT
  WITH CHECK (public.is_event_staff());

-- Préférences in-app (complète migration 005)
UPDATE public.users_profile
SET notification_preferences = COALESCE(notification_preferences, '{}'::JSONB) || '{
  "app_evenement": true,
  "app_billetterie": true,
  "app_messagerie": true,
  "app_soumissions": true
}'::JSONB;

-- Notifications de bienvenue pour les comptes existants
INSERT INTO public.user_notifications (user_id, type, title, body, link)
SELECT
  up.id,
  'evenement',
  'Bienvenue sur JSAN 2025',
  'Votre espace est prêt. Consultez la billetterie pour réserver votre place aux journées.',
  '/dashboard/billetterie'
FROM public.users_profile up
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_notifications un
  WHERE un.user_id = up.id
    AND un.title = 'Bienvenue sur JSAN 2025'
);

-- Exemple pour le compte participant de test
INSERT INTO public.user_notifications (user_id, type, title, body, link)
SELECT
  u.id,
  'billetterie',
  'Tarifs réduits disponibles',
  'Les billets étudiant et membre SNB nécessitent un justificatif validé dans votre profil.',
  '/dashboard/profil'
FROM auth.users u
WHERE u.email = 'participant@jsan-test.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_notifications un
    WHERE un.user_id = u.id
      AND un.title = 'Tarifs réduits disponibles'
  );
