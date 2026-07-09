import { NextResponse } from 'next/server';
import { settleTicketPayment } from '@/lib/kkiapay-settle';

// Appelé par le navigateur après un paiement réussi dans le widget Kkiapay.
// Ne fait confiance QU'À la vérification serveur (verifyKkiapayTransaction) :
// le client ne peut pas forger un « Payé ». Le webhook sert de filet de secours.
export async function POST(request: Request) {
  let body: { transactionId?: string; ticketId?: string };
  try {
    body = (await request.json()) as { transactionId?: string; ticketId?: string };
  } catch {
    return NextResponse.json({ ok: false, message: 'Corps JSON invalide.' }, { status: 400 });
  }

  const transactionId = (body.transactionId ?? '').trim();
  const ticketId = (body.ticketId ?? '').trim();
  if (!transactionId || !ticketId) {
    return NextResponse.json({ ok: false, message: 'transactionId et ticketId requis.' }, { status: 400 });
  }

  const result = await settleTicketPayment(ticketId, transactionId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
