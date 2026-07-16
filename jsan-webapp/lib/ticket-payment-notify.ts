import { createAdminClient } from '@/lib/supabase/admin';
import { sendUserTemplateEmail } from '@/lib/user-template-email';
import { TICKET_CATALOG } from '@/lib/tickets';
import type { TicketPaymentLinks } from '@/lib/tickets';

interface TicketRow {
  id: string;
  user_id: string;
  type_billet: string;
  ticket_type_id?: string | null;
  montant: number | null;
  transaction_id_kkiapay: string | null;
}

function formatMontant(montant: number | null): string {
  return montant != null ? `${Number(montant).toLocaleString('fr-FR')} FCFA` : '';
}

async function resolvePaymentLink(
  ticket: Pick<TicketRow, 'type_billet' | 'ticket_type_id'>
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from('events_config')
    .select('ticket_payment_links')
    .limit(1)
    .maybeSingle();
  if (!config?.ticket_payment_links || typeof config.ticket_payment_links !== 'object') return null;

  const links = config.ticket_payment_links as TicketPaymentLinks;

  let ticketId = ticket.ticket_type_id ?? null;
  if (!ticketId) {
    const { data: byTitle } = await admin
      .from('ticket_types')
      .select('id')
      .eq('title', ticket.type_billet)
      .maybeSingle();
    ticketId =
      (byTitle?.id as string | undefined) ??
      TICKET_CATALOG.find((t) => t.title === ticket.type_billet)?.id ??
      null;
  }

  if (!ticketId) return null;
  return links[ticketId]?.trim() || null;
}

export async function sendTicketPaymentEmailServer(
  ticket: TicketRow,
  kind: 'payment_confirmed' | 'payment_failed'
): Promise<void> {
  const admin = createAdminClient();
  const paymentLink = await resolvePaymentLink(ticket);
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
