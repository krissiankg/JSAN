-- JSAN — Stock / quota / fenêtre de vente par billet
-- À exécuter dans Supabase SQL Editor après 038.

ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS stock_limit INTEGER
    CHECK (stock_limit IS NULL OR stock_limit >= 0),
  ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.ticket_types.stock_limit IS
  'Quota max (Payé + En attente). NULL = illimité.';
COMMENT ON COLUMN public.ticket_types.sale_starts_at IS
  'Début de vente (NULL = dès maintenant si actif).';
COMMENT ON COLUMN public.ticket_types.sale_ends_at IS
  'Fin de vente (NULL = pas de fin).';
