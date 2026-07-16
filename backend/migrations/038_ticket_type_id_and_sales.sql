-- JSAN — Achats liés à ticket_types + ouverture ventes billets
-- À exécuter dans Supabase SQL Editor après 037_ticket_types.sql.

-- 1) Référence stable vers le catalogue
ALTER TABLE public.tickets_registrations
  ADD COLUMN IF NOT EXISTS ticket_type_id TEXT REFERENCES public.ticket_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_registrations_ticket_type_id_idx
  ON public.tickets_registrations (ticket_type_id);

CREATE INDEX IF NOT EXISTS tickets_registrations_user_pending_idx
  ON public.tickets_registrations (user_id, ticket_type_id, statut_paiement);

-- Backfill depuis le titre catalogue
UPDATE public.tickets_registrations tr
SET ticket_type_id = tt.id
FROM public.ticket_types tt
WHERE tr.ticket_type_id IS NULL
  AND tr.type_billet = tt.title;

-- Garder la tentative En_Attente la plus récente par (user, billet)
DELETE FROM public.tickets_registrations a
USING public.tickets_registrations b
WHERE a.statut_paiement = 'En_Attente'
  AND b.statut_paiement = 'En_Attente'
  AND a.ticket_type_id IS NOT NULL
  AND a.ticket_type_id = b.ticket_type_id
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Une seule tentative « En_Attente » par utilisateur et billet catalogue
CREATE UNIQUE INDEX IF NOT EXISTS tickets_registrations_one_pending_per_type_uidx
  ON public.tickets_registrations (user_id, ticket_type_id)
  WHERE statut_paiement = 'En_Attente' AND ticket_type_id IS NOT NULL;

-- Les participants peuvent mettre à jour leurs propres tentatives en attente (réutilisation)
DROP POLICY IF EXISTS "users_update_own_pending_tickets" ON public.tickets_registrations;
CREATE POLICY "users_update_own_pending_tickets"
  ON public.tickets_registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND statut_paiement = 'En_Attente')
  WITH CHECK (auth.uid() = user_id AND statut_paiement = 'En_Attente');

-- 2) Ouverture / fermeture des ventes de billets (indépendant des inscriptions compte)
ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS tickets_sales_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tickets_sales_closed_message TEXT
    DEFAULT 'La billetterie est actuellement fermée. Vous pouvez créer un compte, mais les paiements ne sont pas disponibles pour le moment.';

CREATE OR REPLACE FUNCTION public.get_tickets_sales_status()
RETURNS TABLE (open BOOLEAN, message TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ec.tickets_sales_open, true),
    COALESCE(
      NULLIF(TRIM(ec.tickets_sales_closed_message), ''),
      'La billetterie est actuellement fermée. Vous pouvez créer un compte, mais les paiements ne sont pas disponibles pour le moment.'
    )
  FROM public.events_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_tickets_sales_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_sales_status() TO anon, authenticated;
