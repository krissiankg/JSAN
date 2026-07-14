// Intégration Kkiapay — helpers partagés (client + serveur).
//
// Modèle retenu (réconciliation exacte) :
//   1. Le navigateur ouvre le widget Kkiapay avec `data = { ticketId }`.
//   2. Kkiapay renvoie un `transactionId` (callback front + webhook serveur).
//   3. Le serveur vérifie la transaction via l'API Kkiapay (clé privée + secret)
//      puis passe le billet à « Payé » — jamais depuis le navigateur (RLS).
//
// Les clés peuvent venir de la table `kkiapay_settings` (admin UI) ou des
// variables d'environnement (secours / Netlify).

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveKkiapayCredentials } from '@/lib/kkiapay-settings';

/** @deprecated Préférer /api/kkiapay/public-config — conservé pour compat. */
export function isKkiapaySandbox(): boolean {
  return (process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX ?? '').toLowerCase() !== 'false';
}

/** @deprecated Préférer /api/kkiapay/public-config */
export function getKkiapayPublicKey(): string {
  return (process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY ?? '').trim();
}

/** @deprecated Préférer /api/kkiapay/public-config */
export function isKkiapayWidgetConfigured(): boolean {
  return getKkiapayPublicKey().length > 0;
}

function kkiapayApiBase(sandbox: boolean): string {
  return sandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me';
}

export async function isKkiapayServerConfigured(): Promise<boolean> {
  const admin = createAdminClient();
  const creds = await resolveKkiapayCredentials(admin);
  return Boolean(creds.publicKey && creds.privateKey && creds.secretKey);
}

export interface KkiapayVerification {
  ok: boolean;
  status: string | null;
  amount: number | null;
  raw: unknown;
  error?: string;
}

/**
 * Vérifie une transaction auprès de Kkiapay (source de vérité côté serveur).
 * Retourne ok = true uniquement si le statut est SUCCESS.
 */
export async function verifyKkiapayTransaction(
  transactionId: string
): Promise<KkiapayVerification> {
  const admin = createAdminClient();
  const creds = await resolveKkiapayCredentials(admin);

  if (!creds.publicKey || !creds.privateKey || !creds.secretKey) {
    return { ok: false, status: null, amount: null, raw: null, error: 'Kkiapay non configuré (clés serveur manquantes).' };
  }
  if (!transactionId || typeof transactionId !== 'string') {
    return { ok: false, status: null, amount: null, raw: null, error: 'transactionId manquant.' };
  }

  try {
    const res = await fetch(`${kkiapayApiBase(creds.sandbox)}/api/v1/transactions/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.publicKey,
        'x-private-key': creds.privateKey,
        'x-secret-key': creds.secretKey,
      },
      body: JSON.stringify({ transactionId }),
      cache: 'no-store',
    });

    const raw: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: null, amount: null, raw, error: `Kkiapay HTTP ${res.status}` };
    }

    const obj = (raw ?? {}) as Record<string, unknown>;
    const status = typeof obj.status === 'string' ? obj.status : null;
    const amountVal = obj.amount;
    const amount = typeof amountVal === 'number' ? amountVal : Number(amountVal);

    return {
      ok: status?.toUpperCase() === 'SUCCESS',
      status,
      amount: Number.isFinite(amount) ? amount : null,
      raw,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      amount: null,
      raw: null,
      error: err instanceof Error ? err.message : 'Erreur réseau Kkiapay.',
    };
  }
}

/**
 * Extrait notre référence (ticketId) transmise via le champ `data` du widget.
 * Kkiapay peut renvoyer `stateData` (string JSON) ou `data`.
 */
export function extractTicketIdFromWebhook(payload: Record<string, unknown>): string | null {
  const candidates = [payload.stateData, payload.state_data, payload.data];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'object' && c !== null && 'ticketId' in c) {
      const v = (c as Record<string, unknown>).ticketId;
      if (typeof v === 'string' && v) return v;
    }
    if (typeof c === 'string') {
      try {
        const parsed = JSON.parse(c) as Record<string, unknown>;
        if (typeof parsed.ticketId === 'string' && parsed.ticketId) return parsed.ticketId;
      } catch {
        // pas du JSON : ignore
      }
    }
  }
  return null;
}
