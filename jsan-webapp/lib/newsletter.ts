import type { SupabaseClient } from '@supabase/supabase-js';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export async function subscribeNewsletterViaRpc(
  supabase: SupabaseClient,
  email: string,
  source = 'footer'
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('subscribe_newsletter', {
    p_email: email.trim(),
    p_source: source,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const row = (data as Array<{ ok: boolean; message: string }> | null)?.[0];
  if (!row) {
    return { ok: false, message: 'Inscription impossible pour le moment.' };
  }

  return { ok: Boolean(row.ok), message: row.message };
}

export async function fetchActiveNewsletterSubscribers(
  supabase: SupabaseClient
): Promise<NewsletterSubscriber[]> {
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, status, source, subscribed_at, unsubscribed_at')
    .eq('status', 'active')
    .order('subscribed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as NewsletterSubscriber[];
}

export async function fetchNewsletterSubscriberStats(
  supabase: SupabaseClient
): Promise<{ active: number; total: number }> {
  const { count: total, error: totalError } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true });

  const { count: active, error: activeError } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (totalError || activeError) {
    return { active: 0, total: 0 };
  }

  return { active: active ?? 0, total: total ?? 0 };
}
