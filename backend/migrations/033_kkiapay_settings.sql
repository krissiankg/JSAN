-- JSAN — Configuration Kkiapay (clés API)
-- Table séparée de events_config : les secrets ne doivent PAS être lisibles
-- par tous les utilisateurs authentifiés.
--
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.kkiapay_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_key TEXT,
  private_key TEXT,
  secret_key TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL
);

-- Une seule ligne de configuration
INSERT INTO public.kkiapay_settings (sandbox)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.kkiapay_settings);

ALTER TABLE public.kkiapay_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_kkiapay_settings" ON public.kkiapay_settings;
CREATE POLICY "staff_manage_kkiapay_settings"
  ON public.kkiapay_settings FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

-- Lecture publique limitée à la clé publique (pour le widget billetterie)
-- via RPC SECURITY DEFINER — ne renvoie jamais private_key / secret_key.
CREATE OR REPLACE FUNCTION public.get_kkiapay_public_config()
RETURNS TABLE (public_key TEXT, sandbox BOOLEAN, configured BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    NULLIF(trim(ks.public_key), ''),
    COALESCE(ks.sandbox, true),
    (
      NULLIF(trim(ks.public_key), '') IS NOT NULL
      AND NULLIF(trim(ks.private_key), '') IS NOT NULL
      AND NULLIF(trim(ks.secret_key), '') IS NOT NULL
    )
  FROM public.kkiapay_settings ks
  ORDER BY ks.updated_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_kkiapay_public_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kkiapay_public_config() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
