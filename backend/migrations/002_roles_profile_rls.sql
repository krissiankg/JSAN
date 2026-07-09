-- JSAN 2025 - Migration 002b
-- À exécuter dans Supabase SQL Editor APRÈS :
--   1. schema.sql
--   2. 002a_add_enum_values.sql  ← obligatoire (erreur 55P04 sinon)
--
-- Ajoute colonnes profil, trigger inscription, et politiques RLS

-- 1. Colonnes de vérification billetterie
ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS is_student_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_member_verified BOOLEAN DEFAULT false;

-- 2. Trigger : créer users_profile à l'inscription Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  assigned_role user_role;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'participant');

  assigned_role := CASE requested_role
    WHEN 'participant' THEN 'participant'::user_role
    WHEN 'auteur' THEN 'auteur'::user_role
    WHEN 'pair_en_attente' THEN 'pair_en_attente'::user_role
    WHEN 'pair' THEN 'pair_en_attente'::user_role
    WHEN 'pair_valide' THEN 'pair_valide'::user_role
    WHEN 'organisateur' THEN 'organisateur'::user_role
    WHEN 'superadmin' THEN 'superadmin'::user_role
    WHEN 'admin' THEN 'superadmin'::user_role
    ELSE 'participant'::user_role
  END;

  INSERT INTO public.users_profile (
    id, role, nom, prenom, institution, specialite, telephone
  ) VALUES (
    NEW.id,
    assigned_role,
    NEW.raw_user_meta_data->>'nom',
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'institution',
    NEW.raw_user_meta_data->>'specialite',
    NEW.raw_user_meta_data->>'telephone'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. RLS sur users_profile
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.users_profile;
CREATE POLICY "users_read_own_profile"
  ON public.users_profile FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "staff_read_all_profiles" ON public.users_profile;
CREATE POLICY "staff_read_all_profiles"
  ON public.users_profile FOR SELECT
  USING (public.is_event_staff());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.users_profile;
CREATE POLICY "users_update_own_profile"
  ON public.users_profile FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users_profile WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_update_any_profile" ON public.users_profile;
CREATE POLICY "staff_update_any_profile"
  ON public.users_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid()
        AND up.role IN ('organisateur', 'superadmin', 'admin')
    )
  );

-- 4. RLS de base sur abstracts
ALTER TABLE public.abstracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authors_manage_own_abstracts" ON public.abstracts;
CREATE POLICY "authors_manage_own_abstracts"
  ON public.abstracts FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_all_abstracts" ON public.abstracts;
CREATE POLICY "staff_manage_all_abstracts"
  ON public.abstracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid()
        AND up.role IN ('organisateur', 'superadmin', 'admin', 'pair_valide')
    )
  );

-- 5. Config événement
ALTER TABLE public.events_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_events_config" ON public.events_config;
CREATE POLICY "authenticated_read_events_config"
  ON public.events_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_manage_events_config" ON public.events_config;
CREATE POLICY "staff_manage_events_config"
  ON public.events_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid()
        AND up.role IN ('organisateur', 'superadmin', 'admin')
    )
  );
