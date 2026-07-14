import { createAdminClient } from '@/lib/supabase/admin';
import { sendUserTemplateEmail } from '@/lib/user-template-email';
import { TICKET_CATALOG } from '@/lib/tickets';
import type { TicketPaymentLinks } from '@/lib/tickets';

interface TicketRow {
  id: string;
  user_id: string;
  type_billet: string;
  montant: number | null;
  transaction_id_kkiapay: string | null;
}

function formatMontant(montant: number | null): string {
  return montant != null ? `${Number(montant).toLocaleString('fr-FR')} FCFA` : '';
}

async function resolvePaymentLink(typeBillet: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('events_config').select('ticket_payment_links').limit(1).maybeSingle();
  if (!data?.ticket_payment_links || typeof data.ticket_payment_links !== 'object') return null;

  const links = data.ticket_payment_links as TicketPaymentLinks;
  const catalogItem = TICKET_CATALOG.find((t) => t.title === typeBillet);
  if (!catalogItem) return null;
  return links[catalogItem.id]?.trim() || null;
}

export async function sendTicketPaymentEmailServer(
  ticket: TicketRow,
  kind: 'payment_confirmed' | 'payment_failed'
): Promise<void> {
  const admin = createAdminClient();
  const paymentLink = await resolvePaymentLink(ticket.type_billet);
  const montant = formatMontant(ticket.montant);

  if (kind === 'payment_confirmed') {
    await sendUserTemplateEmail({
      admin,
      userId: ticket.user_id,
      notificationType: 'billetterie',
      templateKey: 'payment_confirmed',
      title: 'Paiement confirmé',
      body: `Votre paiement pour « ${ticket.type_billet} » a été confirmé.`,
      link: '/dashboard/billetterie',
      variables: {
        type_billet: ticket.type_billet,
        montant,
        reference: ticket.transaction_id_kkiapay ?? ticket.id,
      },
    });
    return;
  }

  await sendUserTemplateEmail({
    admin,
    userId: ticket.user_id,
    notificationType: 'billetterie',
    templateKey: 'payment_failed',
    title: 'Paiement échoué',
    body: `Votre tentative de paiement pour « ${ticket.type_billet} » n'a pas abouti.`,
    link: paymentLink ?? '/dashboard/billetterie',
    variables: {
      type_billet: ticket.type_billet,
      montant,
      lien_paiement: paymentLink ?? '',
    },
  });
}
