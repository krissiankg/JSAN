-- JSAN 2025 - Migration 003
-- Corrige la récursion infinie RLS sur users_profile
-- Erreur : "infinite recursion detected in policy for relation users_profile"
-- À exécuter dans Supabase SQL Editor

-- Fonctions helper (SECURITY DEFINER = pas de récursion RLS)
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users_profile WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_event_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
      AND role IN ('organisateur', 'superadmin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_reviewer_or_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
      AND role IN ('organisateur', 'superadmin', 'admin', 'pair_valide')
  );
$$;

-- users_profile : policies corrigées
DROP POLICY IF EXISTS "users_read_own_profile" ON public.users_profile;
DROP POLICY IF EXISTS "staff_read_all_profiles" ON public.users_profile;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users_profile;
DROP POLICY IF EXISTS "staff_update_any_profile" ON public.users_profile;

CREATE POLICY "users_read_own_profile"
  ON public.users_profile FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "staff_read_all_profiles"
  ON public.users_profile FOR SELECT
  USING (public.is_event_staff());

CREATE POLICY "users_update_own_profile"
  ON public.users_profile FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_my_profile_role()
  );

CREATE POLICY "staff_update_any_profile"
  ON public.users_profile FOR UPDATE
  USING (public.is_event_staff());

-- abstracts : policies corrigées
DROP POLICY IF EXISTS "staff_manage_all_abstracts" ON public.abstracts;
CREATE POLICY "staff_manage_all_abstracts"
  ON public.abstracts FOR ALL
  USING (public.is_reviewer_or_staff());

-- events_config : policy corrigée
DROP POLICY IF EXISTS "staff_manage_events_config" ON public.events_config;
CREATE POLICY "staff_manage_events_config"
  ON public.events_config FOR ALL
  USING (public.is_event_staff());
