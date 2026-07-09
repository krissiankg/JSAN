import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_REGISTRATIONS_CLOSED_MESSAGE =
  "Les inscriptions sur la plateforme JSAN sont actuellement closes. Revenez bientôt ou contactez l'équipe organisatrice si vous avez besoin d'aide.";

export interface RegistrationsStatus {
  open: boolean;
  message: string;
}

export interface RegistrationsSettings {
  id: string;
  registrations_open: boolean;
  registrations_closed_message: string | null;
}

export function isRegistrationsForcedClosedByEnv(): boolean {
  return (process.env.REGISTRATIONS_CLOSED ?? '').trim().toLowerCase() === 'true';
}

export function registrationsClosedMessageFromEnv(): string {
  const custom = (process.env.REGISTRATIONS_CLOSED_MESSAGE ?? '').trim();
  return custom || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE;
}

export async function fetchRegistrationsStatusFromApi(): Promise<RegistrationsStatus> {
  if (isRegistrationsForcedClosedByEnv()) {
    return { open: false, message: registrationsClosedMessageFromEnv() };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { open: true, message: DEFAULT_REGISTRATIONS_CLOSED_MESSAGE };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_registrations_status`, {
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
      return { open: true, message: DEFAULT_REGISTRATIONS_CLOSED_MESSAGE };
    }

    const rows = (await res.json()) as Array<{ open: boolean; message: string }>;
    const row = rows[0];
    if (!row) {
      return { open: true, message: DEFAULT_REGISTRATIONS_CLOSED_MESSAGE };
    }

    return {
      open: Boolean(row.open),
      message: row.message?.trim() || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE,
    };
  } catch {
    return { open: true, message: DEFAULT_REGISTRATIONS_CLOSED_MESSAGE };
  }
}

export async function fetchRegistrationsSettings(
  supabase: SupabaseClient
): Promise<RegistrationsSettings | null> {
  const { data } = await supabase
    .from('events_config')
    .select('id, registrations_open, registrations_closed_message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as RegistrationsSettings | null;
}

export async function updateRegistrationsSettings(
  supabase: SupabaseClient,
  configId: string,
  input: { open: boolean; message?: string }
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    registrations_open: input.open,
  };
  if (input.message !== undefined) {
    payload.registrations_closed_message =
      input.message.trim() || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE;
  }

  const { error } = await supabase
    .from('events_config')
    .update(payload)
    .eq('id', configId);

  return error?.message ?? null;
}
