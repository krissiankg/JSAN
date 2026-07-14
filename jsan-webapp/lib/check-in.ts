import type { SupabaseClient } from '@supabase/supabase-js';
import { formatFcfa, paymentStatusLabel, type PaymentStatus, type TicketRegistration } from '@/lib/tickets';

export interface BadgeTicket extends TicketRegistration {
  badge_token: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

export interface CheckInResult {
  ok: boolean;
  message: string;
  ticket?: {
    id: string;
    type_billet: string;
    montant: number | null;
    statut_paiement: PaymentStatus;
    checked_in_at: string | null;
    holderName: string;
    holderEmail: string | null;
    alreadyCheckedIn: boolean;
  };
}

export function qrImageUrl(payload: string, size = 220): string {
  const data = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${data}`;
}

/** Code court affiché sous le QR (8 premiers caractères du token). */
export function shortBadgeCode(token: string): string {
  return token.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function formatCheckInAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchMyPaidBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<BadgeTicket[]> {
  const { data, error } = await supabase
    .from('tickets_registrations')
    .select('id, user_id, type_billet, transaction_id_kkiapay, montant, statut_paiement, created_at, badge_token, checked_in_at, checked_in_by')
    .eq('user_id', userId)
    .eq('statut_paiement', 'Paye')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BadgeTicket[];
}

export async function checkInByBadgeToken(
  supabase: SupabaseClient,
  rawToken: string,
  staffUserId: string
): Promise<CheckInResult> {
  const cleaned = rawToken.trim().replace(/\s+/g, '');
  if (!cleaned) {
    return { ok: false, message: 'Saisissez ou scannez un code badge.' };
  }

  // Accepte UUID complet ou code court (8 car.)
  let query = supabase
    .from('tickets_registrations')
    .select('id, user_id, type_billet, montant, statut_paiement, badge_token, checked_in_at');

  if (cleaned.includes('-') && cleaned.length >= 32) {
    query = query.eq('badge_token', cleaned.toLowerCase());
  } else {
    const prefix = cleaned.replace(/-/g, '').toLowerCase().slice(0, 8);
    if (prefix.length < 6) {
      return { ok: false, message: 'Code trop court.' };
    }
    // Filtre côté app si le préfixe n'est pas indexé — on récupère les billets payés récents matching
    const { data: rows, error } = await supabase
      .from('tickets_registrations')
      .select('id, user_id, type_billet, montant, statut_paiement, badge_token, checked_in_at')
      .eq('statut_paiement', 'Paye')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return { ok: false, message: error.message };
    const match = (rows ?? []).find((r) =>
      String(r.badge_token ?? '').replace(/-/g, '').toLowerCase().startsWith(prefix)
    );
    if (!match) return { ok: false, message: 'Aucun billet trouvé pour ce code.' };
    return finalizeCheckIn(supabase, match, staffUserId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: 'Aucun billet trouvé pour ce code.' };
  return finalizeCheckIn(supabase, data, staffUserId);
}

async function finalizeCheckIn(
  supabase: SupabaseClient,
  ticket: {
    id: string;
    user_id: string;
    type_billet: string;
    montant: number | null;
    statut_paiement: PaymentStatus;
    badge_token: string;
    checked_in_at: string | null;
  },
  staffUserId: string
): Promise<CheckInResult> {
  if (ticket.statut_paiement !== 'Paye') {
    return {
      ok: false,
      message: `Billet non payé (${paymentStatusLabel(ticket.statut_paiement)}).`,
    };
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('prenom, nom')
    .eq('id', ticket.user_id)
    .maybeSingle();

  const holderName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim() || 'Participant';

  if (ticket.checked_in_at) {
    return {
      ok: true,
      message: `Déjà enregistré le ${formatCheckInAt(ticket.checked_in_at)}.`,
      ticket: {
        id: ticket.id,
        type_billet: ticket.type_billet,
        montant: ticket.montant,
        statut_paiement: ticket.statut_paiement,
        checked_in_at: ticket.checked_in_at,
        holderName,
        holderEmail: null,
        alreadyCheckedIn: true,
      },
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('tickets_registrations')
    .update({ checked_in_at: now, checked_in_by: staffUserId })
    .eq('id', ticket.id)
    .is('checked_in_at', null);

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: `Entrée validée — ${holderName} · ${ticket.type_billet} · ${formatFcfa(ticket.montant)}`,
    ticket: {
      id: ticket.id,
      type_billet: ticket.type_billet,
      montant: ticket.montant,
      statut_paiement: ticket.statut_paiement,
      checked_in_at: now,
      holderName,
      holderEmail: null,
      alreadyCheckedIn: false,
    },
  };
}

export async function fetchCheckInStats(supabase: SupabaseClient): Promise<{
  paid: number;
  checkedIn: number;
}> {
  const { data, error } = await supabase
    .from('tickets_registrations')
    .select('checked_in_at')
    .eq('statut_paiement', 'Paye');

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    paid: rows.length,
    checkedIn: rows.filter((r) => Boolean(r.checked_in_at)).length,
  };
}
