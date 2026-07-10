import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmailCampaignLog {
  id: string;
  created_by: string | null;
  campaign_kind: 'broadcast' | 'test' | 'account' | 'newsletter' | 'blog';
  template_key: string;
  audience_label: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchEmailCampaignLogs(supabase: SupabaseClient): Promise<EmailCampaignLog[]> {
  const { data, error } = await supabase
    .from('email_campaign_logs')
    .select('id, created_by, campaign_kind, template_key, audience_label, recipient_count, sent_count, failed_count, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailCampaignLog[];
}
