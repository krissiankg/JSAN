import type { SupabaseClient } from '@supabase/supabase-js';

import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email';
import { resolveEmailCtaUrl } from '@/lib/email-template-links';
import { fetchEmailTemplateConfig, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';
import type { NotificationType } from '@/lib/notifications';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/roles';

const TYPE_TO_EMAIL_PREF: Record<NotificationType, keyof NotificationPreferences | null> = {
  evenement: 'email_evenement',
  billetterie: 'email_billetterie',
  messagerie: 'email_messagerie',
  soumission: 'email_soumissions',
  system: null,
};

export interface SendUserTemplateEmailInput {
  admin: SupabaseClient;
  userId: string;
  notificationType: NotificationType;
  templateKey: EmailTemplateKey;
  title: string;
  body?: string | null;
  link?: string | null;
  variables?: Record<string, string | null | undefined>;
  insertNotification?: boolean;
  baseUrl?: string;
}

export async function sendUserTemplateEmail(
  input: SendUserTemplateEmailInput
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const {
    admin,
    userId,
    notificationType,
    templateKey,
    title,
    body,
    link,
    variables = {},
    insertNotification = true,
    baseUrl,
  } = input;

  if (insertNotification) {
    const { error } = await admin.from('user_notifications').insert({
      user_id: userId,
      type: notificationType,
      title,
      body: body ?? null,
      link: link ?? null,
    });
    if (error && process.env.NODE_ENV === 'development') {
      console.warn('[sendUserTemplateEmail] notification insert', error.message);
    }
  }

  if (!isEmailConfigured()) {
    return { ok: false, skipped: true, reason: 'email_not_configured' };
  }

  const { data: recipient, error: recipientErr } = await admin.auth.admin.getUserById(userId);
  if (recipientErr || !recipient?.user?.email) {
    return { ok: false, skipped: true, reason: 'recipient_not_found' };
  }

  const { data: profile } = await admin
    .from('users_profile')
    .select('prenom, nom, notification_preferences')
    .eq('id', userId)
    .maybeSingle();

  const prefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...((profile?.notification_preferences as NotificationPreferences | null) ?? {}),
  };
  const prefKey = TYPE_TO_EMAIL_PREF[notificationType];
  if (prefKey && prefs[prefKey] === false) {
    return { ok: false, skipped: true, reason: 'opted_out' };
  }

  const config = await fetchEmailTemplateConfig(admin);
  const template = config?.email_templates[templateKey];
  if (!template?.enabled) {
    return { ok: false, skipped: true, reason: 'template_disabled' };
  }

  const base =
    (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || 'https://snb-jsan.bj';
  const recipientName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || null;

  const rendered = renderEmailTemplate(template, {
    prenom: profile?.prenom ?? '',
    nom_complet: recipientName ?? '',
    email: recipient.user.email,
    lien_plateforme: base,
    ...variables,
  });

  const ctaUrl = resolveEmailCtaUrl(base, {
    templateKey,
    variables,
    overrideLink: link,
  });

  const html = renderNotificationEmail({
    title: rendered.title || title,
    body: rendered.body || body || title,
    ctaLabel: rendered.ctaLabel || 'Ouvrir la plateforme',
    ctaUrl,
    recipientName,
  });

  const result = await sendEmail({
    to: recipient.user.email,
    subject: `JSAN 2025 — ${rendered.subject || title}`,
    html,
    text: rendered.body || rendered.subject || title,
  });

  return result.ok
    ? { ok: true }
    : { ok: false, skipped: result.skipped, reason: result.error ?? 'send_failed' };
}
