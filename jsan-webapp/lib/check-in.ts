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

export interface CheckInHistoryRow {
  id: string;
  type_billet: string;
  montant: number | null;
  checked_in_at: string;
  holderName: string;
  shortCode: string;
}

export interface CheckInStats {
  paid: number;
  checkedIn: number;
  remaining: number;
  lastHour: number;
}

/** @deprecated Prefer BadgeQrCode (génération locale). Conservé pour compat. */
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

export function normalizeBadgeScanInput(raw: string): string {
  return raw.trim().replace(/^JSAN:/i, '').replace(/\s+/g, '');
}

export async function fetchMyPaidBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<BadgeTicket[]> {
  const { data, error } = await supabase
    .from('tickets_registrations')
    .select('id, user_id, type_billet, ticket_type_id, transaction_id_kkiapay, montant, statut_paiement, created_at, badge_token, checked_in_at, checked_in_by')
    .eq('user_id', userId)
    .eq('statut_paiement', 'Paye')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BadgeTicket[];
}

/** Génère / régénère le token badge au passage à Payé (évite d’exposer un token « En attente »). */
export async function issueBadgeTokenOnPayment(
  supabase: SupabaseClient,
  ticketId: string
): Promise<string | null> {
  const token =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const { data, error } = await supabase
    .from('tickets_registrations')
    .update({ badge_token: token })
    .eq('id', ticketId)
    .select('badge_token')
    .maybeSingle();

  if (error) return null;
  return (data?.badge_token as string | undefined) ?? token;
}

export async function userHasPaidTicketType(
  supabase: SupabaseClient,
  userId: string,
  ticketTypeId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('tickets_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ticket_type_id', ticketTypeId)
    .eq('statut_paiement', 'Paye');

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function checkInByBadgeToken(
  supabase: SupabaseClient,
  rawToken: string,
  staffUserId: string
): Promise<CheckInResult> {
  const cleaned = normalizeBadgeScanInput(rawToken);
  if (!cleaned) {
    return { ok: false, message: 'Saisissez ou scannez un code badge.' };
  }

  if (cleaned.includes('-') && cleaned.length >= 32) {
    const { data, error } = await supabase
      .from('tickets_registrations')
      .select('id, user_id, type_billet, montant, statut_paiement, badge_token, checked_in_at')
      .eq('badge_token', cleaned.toLowerCase())
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, message: 'Aucun billet trouvé pour ce code.' };
    return finalizeCheckIn(supabase, data, staffUserId);
  }

  const prefix = cleaned.replace(/-/g, '').toLowerCase().slice(0, 8);
  if (prefix.length < 6) {
    return { ok: false, message: 'Code trop court.' };
  }

  const { data: rows, error } = await supabase
    .from('tickets_registrations')
    .select('id, user_id, type_billet, montant, statut_paiement, badge_token, checked_in_at')
    .eq('statut_paiement', 'Paye')
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) return { ok: false, message: error.message };
  const match = (rows ?? []).find((r) =>
    String(r.badge_token ?? '').replace(/-/g, '').toLowerCase().startsWith(prefix)
  );
  if (!match) return { ok: false, message: 'Aucun billet trouvé pour ce code.' };
  return finalizeCheckIn(supabase, match, staffUserId);
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

  // Notif in-app participant (best-effort)
  try {
    const { notifyCheckInSuccess } = await import('@/lib/notifications');
    void notifyCheckInSuccess(supabase, ticket.user_id, {
      typeBillet: ticket.type_billet,
      checkedInAt: now,
    });
  } catch {
    /* ignore */
  }

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

export async function fetchCheckInStats(supabase: SupabaseClient): Promise<CheckInStats> {
  const { data, error } = await supabase
    .from('tickets_registrations')
    .select('checked_in_at')
    .eq('statut_paiement', 'Paye');

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const checkedIn = rows.filter((r) => Boolean(r.checked_in_at));
  return {
    paid: rows.length,
    checkedIn: checkedIn.length,
    remaining: Math.max(0, rows.length - checkedIn.length),
    lastHour: checkedIn.filter((r) => {
      const t = r.checked_in_at ? new Date(r.checked_in_at).getTime() : 0;
      return t >= hourAgo;
    }).length,
  };
}

export async function fetchRecentCheckIns(
  supabase: SupabaseClient,
  limit = 25
): Promise<CheckInHistoryRow[]> {
  const { data, error } = await supabase
    .from('tickets_registrations')
    .select('id, type_billet, montant, badge_token, checked_in_at, user_id')
    .eq('statut_paiement', 'Paye')
    .not('checked_in_at', 'is', null)
    .order('checked_in_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string).filter(Boolean))];
  const nameById = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('users_profile')
      .select('id, prenom, nom')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      const name = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || 'Participant';
      nameById.set(p.id as string, name);
    }
  }

  return rows.map((r) => ({
    id: r.id as string,
    type_billet: r.type_billet as string,
    montant: r.montant as number | null,
    checked_in_at: r.checked_in_at as string,
    holderName: nameById.get(r.user_id as string) ?? 'Participant',
    shortCode: shortBadgeCode(String(r.badge_token ?? '')),
  }));
}

export function exportCheckInHistoryCsv(rows: CheckInHistoryRow[]): string {
  const header = ['Horodatage', 'Participant', 'Billet', 'Code', 'Montant'];
  const lines = rows.map((r) =>
    [
      formatCheckInAt(r.checked_in_at),
      r.holderName,
      r.type_billet,
      r.shortCode,
      r.montant != null ? String(r.montant) : '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}
