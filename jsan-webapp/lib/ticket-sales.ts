import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_TICKETS_SALES_CLOSED_MESSAGE =
  'La billetterie est actuellement fermée. Vous pouvez créer un compte, mais les paiements ne sont pas disponibles pour le moment.';

export interface TicketsSalesStatus {
  open: boolean;
  message: string;
}

export interface TicketsSalesSettings {
  id: string;
  tickets_sales_open: boolean;
  tickets_sales_closed_message: string | null;
}

export function isTicketsSalesForcedClosedByEnv(): boolean {
  return (process.env.TICKETS_SALES_CLOSED ?? '').trim().toLowerCase() === 'true';
}

export function ticketsSalesClosedMessageFromEnv(): string {
  const custom = (process.env.TICKETS_SALES_CLOSED_MESSAGE ?? '').trim();
  return custom || DEFAULT_TICKETS_SALES_CLOSED_MESSAGE;
}

export async function fetchTicketsSalesStatusFromApi(): Promise<TicketsSalesStatus> {
  if (isTicketsSalesForcedClosedByEnv()) {
    return { open: false, message: ticketsSalesClosedMessageFromEnv() };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { open: true, message: DEFAULT_TICKETS_SALES_CLOSED_MESSAGE };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_tickets_sales_status`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });

    if (!res.ok) {
      return { open: true, message: DEFAULT_TICKETS_SALES_CLOSED_MESSAGE };
    }

    const rows = (await res.json()) as Array<{ open: boolean; message: string }>;
    const row = rows[0];
    if (!row) {
      return { open: true, message: DEFAULT_TICKETS_SALES_CLOSED_MESSAGE };
    }

    return {
      open: Boolean(row.open),
      message: row.message?.trim() || DEFAULT_TICKETS_SALES_CLOSED_MESSAGE,
    };
  } catch {
    return { open: true, message: DEFAULT_TICKETS_SALES_CLOSED_MESSAGE };
  }
}

export async function fetchTicketsSalesSettings(
  supabase: SupabaseClient
): Promise<TicketsSalesSettings | null> {
  const { data } = await supabase
    .from('events_config')
    .select('id, tickets_sales_open, tickets_sales_closed_message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as TicketsSalesSettings | null;
}

export async function updateTicketsSalesSettings(
  supabase: SupabaseClient,
  configId: string,
  input: { open: boolean; message?: string }
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    tickets_sales_open: input.open,
  };
  if (input.message !== undefined) {
    payload.tickets_sales_closed_message =
      input.message.trim() || DEFAULT_TICKETS_SALES_CLOSED_MESSAGE;
  }

  const { error } = await supabase.from('events_config').update(payload).eq('id', configId);
  return error?.message ?? null;
}
