-- JSAN 2025 - Migration 018
-- Liens de paiement Kkiapay par produit (billet).
--
-- Méthode : l'organisateur crée un lien de paiement hébergé chez Kkiapay
-- pour chaque billet, puis renseigne l'URL dans l'admin. Le bouton « Acheter »
-- redirige le participant vers ce lien (plus de widget / clé en localStorage).
--
-- Stockage : map { <ticket_id>: <url> } dans events_config.ticket_payment_links.
-- Lisible par tous les authentifiés (policy authenticated_read_events_config),
-- modifiable par le staff (staff_manage_events_config).
--
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE public.events_config
  ADD COLUMN IF NOT EXISTS ticket_payment_links JSONB DEFAULT '{}'::jsonb;

UPDATE public.events_config
SET ticket_payment_links = '{}'::jsonb
WHERE ticket_payment_links IS NULL;
