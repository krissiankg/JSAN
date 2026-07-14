import type { SupabaseClient } from '@supabase/supabase-js';

import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email';
import {
  fetchEmailTemplateConfig,
  renderEmailTemplate,
  type EmailTemplateKey,
  type EmailTemplateRecord,
} from '@/lib/email-templates';
import { resolveEmailCtaUrl } from '@/lib/email-template-links';
import { fetchActiveNewsletterSubscribers } from '@/lib/newsletter';

export interface NewsletterSendResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  sent: number;
  failed: number;
  recipientCount: number;
}

export async function sendNewsletterCampaign(params: {
  supabase: SupabaseClient;
  createdBy: string | null;
  templateKey: EmailTemplateKey;
  templateOverride?: EmailTemplateRecord | null;
  variables: Record<string, string | null | undefined>;
  link: string;
  campaignKind: 'newsletter' | 'blog';
  audienceLabel: string;
  metadata?: Record<string, unknown>;
}): Promise<NewsletterSendResult> {
  if (!isEmailConfigured()) {
    return { ok: false, skipped: true, reason: 'email_not_configured', sent: 0, failed: 0, recipientCount: 0 };
  }

  const config = await fetchEmailTemplateConfig(params.supabase);
  const template = params.templateOverride ?? config?.email_templates[params.templateKey];
  if (!template?.enabled) {
    return { ok: false, skipped: true, reason: 'template_disabled', sent: 0, failed: 0, recipientCount: 0 };
  }

  const subscribers = await fetchActiveNewsletterSubscribers(params.supabase);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '') || 'https://snb-jsan.bj';
  const ctaUrl = resolveEmailCtaUrl(base, {
    templateKey: params.templateKey,
    variables: params.variables,
    overrideLink: params.link,
  });

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    const rendered = renderEmailTemplate(template, {
      ...params.variables,
      email: subscriber.email,
      lien_plateforme: base,
    });
    const html = renderNotificationEmail({
      title: rendered.title,
      body: rendered.body,
      ctaLabel: rendered.ctaLabel || 'Lire la suite',
      ctaUrl,
      recipientName: null,
      footerNote:
        'Vous recevez cet e-mail car vous êtes inscrit à la newsletter JSAN. Pour vous désinscrire, contactez secretariat@snb-jsan.bj.',
    });
    const result = await sendEmail({
      to: subscriber.email,
      subject: `JSAN — ${rendered.subject}`,
      html,
      text: rendered.body,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  await params.supabase.from('email_campaign_logs').insert({
    created_by: params.createdBy,
    campaign_kind: params.campaignKind,
    template_key: params.templateKey,
    audience_label: params.audienceLabel,
    recipient_count: subscribers.length,
    sent_count: sent,
    failed_count: failed,
    metadata: {
      link: params.link,
      variables: params.variables,
      ...(params.metadata ?? {}),
    },
  });

  return {
    ok: true,
    sent,
    failed,
    recipientCount: subscribers.length,
  };
}
