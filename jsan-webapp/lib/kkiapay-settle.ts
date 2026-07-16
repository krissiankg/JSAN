import { createAdminClient } from '@/lib/supabase/admin';
import { verifyKkiapayTransaction } from '@/lib/kkiapay';
import { sendTicketPaymentEmailServer } from '@/lib/ticket-payment-notify';

export interface SettleResult {
  ok: boolean;
  status: 'paye' | 'echoue' | 'deja_paye' | 'erreur';
  message: string;
}

/**
 * Règle un billet après paiement : vérifie la transaction auprès de Kkiapay
 * (source de vérité), contrôle le montant, puis passe le billet à « Payé ».
 * Idempotent : rejouer le même transactionId ne casse rien.
 *
 * Utilisé par le callback du widget (/api/kkiapay/confirm) et par le
 * webhook serveur-à-serveur (/api/kkiapay/webhook).
 */
export async function settleTicketPayment(
  ticketId: string,
  transactionId: string
): Promise<SettleResult> {
  if (!ticketId || !transactionId) {
    return { ok: false, status: 'erreur', message: 'ticketId ou transactionId manquant.' };
  }

  const admin = createAdminClient();

  const { data: ticket, error: fetchErr } = await admin
    .from('tickets_registrations')
    .select('id, user_id, type_billet, ticket_type_id, montant, statut_paiement, transaction_id_kkiapay')
    .eq('id', ticketId)
    .maybeSingle();

  if (fetchErr) return { ok: false, status: 'erreur', message: fetchErr.message };
  if (!ticket) return { ok: false, status: 'erreur', message: 'Billet introuvable.' };

  if (ticket.statut_paiement === 'Paye') {
    return { ok: true, status: 'deja_paye', message: 'Billet déjà réglé.' };
  }

  const verification = await verifyKkiapayTransaction(transactionId);

  if (!verification.ok) {
    // Statut renvoyé mais non-SUCCESS => échec avéré : on marque le billet échoué.
    if (verification.status && verification.status.toUpperCase() !== 'SUCCESS') {
      await admin
        .from('tickets_registrations')
        .update({ statut_paiement: 'Echoue', transaction_id_kkiapay: transactionId })
        .eq('id', ticketId);
      if (ticket.user_id) {
        void sendTicketPaymentEmailServer(
          {
            id: ticket.id,
            user_id: ticket.user_id,
            type_billet: ticket.type_billet,
            ticket_type_id: ticket.ticket_type_id,
            montant: ticket.montant,
            transaction_id_kkiapay: transactionId,
          },
          'payment_failed'
        );
      }
      return { ok: false, status: 'echoue', message: `Paiement non abouti (${verification.status}).` };
    }
    return { ok: false, status: 'erreur', message: verification.error ?? 'Vérification Kkiapay impossible.' };
  }

  // Contrôle du montant si connu (évite qu'un billet cher soit validé par un petit paiement).
  if (ticket.montant != null && verification.amount != null) {
    if (Math.round(Number(ticket.montant)) !== Math.round(verification.amount)) {
      return {
        ok: false,
        status: 'erreur',
        message: `Montant incohérent (attendu ${ticket.montant}, reçu ${verification.amount}).`,
      };
    }
  }

  const { error: updateErr } = await admin
    .from('tickets_registrations')
    .update({
      statut_paiement: 'Paye',
      transaction_id_kkiapay: transactionId,
      badge_token: crypto.randomUUID(),
    })
    .eq('id', ticketId);

  if (updateErr) return { ok: false, status: 'erreur', message: updateErr.message };

  if (ticket.user_id) {
    void sendTicketPaymentEmailServer(
      {
        id: ticket.id,
        user_id: ticket.user_id,
        type_billet: ticket.type_billet,
        ticket_type_id: ticket.ticket_type_id,
        montant: ticket.montant,
        transaction_id_kkiapay: transactionId,
      },
      'payment_confirmed'
    );
  }

  return { ok: true, status: 'paye', message: 'Paiement confirmé.' };
}
