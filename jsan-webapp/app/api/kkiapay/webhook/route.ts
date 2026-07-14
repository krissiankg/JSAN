import { NextResponse } from 'next/server';
import { extractTicketIdFromWebhook } from '@/lib/kkiapay';
import { settleTicketPayment } from '@/lib/kkiapay-settle';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveKkiapayCredentials } from '@/lib/kkiapay-settings';

// Webhook serveur-à-serveur : Kkiapay le notifie après chaque paiement.
// Filet de secours si le navigateur du participant se ferme avant le callback.
//
// Sécurité : Kkiapay signe l'appel avec le secret (header x-kkiapay-secret).
export async function POST(request: Request) {
  const admin = createAdminClient();
  const creds = await resolveKkiapayCredentials(admin);
  const secret = creds.secretKey;
  if (!secret) {
    return NextResponse.json({ ok: false, message: 'Webhook non configuré.' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-kkiapay-secret') ??
    request.headers.get('x-kkiapay-signature') ??
    '';
  if (provided !== secret) {
    return NextResponse.json({ ok: false, message: 'Signature invalide.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: 'Corps JSON invalide.' }, { status: 400 });
  }

  const transactionId =
    (typeof payload.transactionId === 'string' && payload.transactionId) ||
    (typeof payload.transaction_id === 'string' && payload.transaction_id) ||
    '';
  const ticketId = extractTicketIdFromWebhook(payload);

  if (!transactionId || !ticketId) {
    // On répond 200 pour éviter que Kkiapay ne renvoie indéfiniment un paiement
    // sans référence exploitable (traité manuellement dans l'admin).
    return NextResponse.json({ ok: false, message: 'Référence billet absente du webhook.' }, { status: 200 });
  }

  const result = await settleTicketPayment(ticketId, transactionId);
  return NextResponse.json(result, { status: 200 });
}
