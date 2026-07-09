import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec la clé service-role : contourne la RLS.
 * À N'UTILISER QUE côté serveur (routes API) — jamais dans un composant client.
 * Sert à confirmer un paiement (passage du billet à « Payé ») après vérification
 * de la transaction auprès de Kkiapay, car les participants ne peuvent pas
 * modifier leurs propres billets (RLS).
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Configuration Supabase serveur manquante (URL ou SERVICE_ROLE_KEY).');
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
