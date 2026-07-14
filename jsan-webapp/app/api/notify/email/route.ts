import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, renderNotificationEmail, isEmailConfigured } from '@/lib/email';
import { fetchEmailTemplateConfig, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';
import { resolveEmailCtaUrl } from '@/lib/email-template-links';
import { DEFAULT_NOTIFICATION_PREFERENCES, mapDbRoleToAppRole, isEventStaff, type NotificationPreferences, type DbUserRole } from '@/lib/roles';
import type { NotificationType } from '@/lib/notifications';

const TYPE_TO_EMAIL_PREF: Record<NotificationType, keyof NotificationPreferences | null> = {
  evenement: 'email_evenement',
  billetterie: 'email_billetterie',
  messagerie: 'email_messagerie',
  soumission: 'email_soumissions',
  system: null,
};

interface Payload {
  userId?: string;
  type?: NotificationType;
  title?: string;
  body?: string | null;
  link?: string | null;
  templateKey?: EmailTemplateKey;
  variables?: Record<string, string | null | undefined>;
}

export async function POST(request: Request) {
  // Envoi ignoré proprement si l'e-mail n'est pas configuré (pas d'erreur bloquante).
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'email_not_configured' }, { status: 200 });
  }

  // Sécurité : seul un membre du staff authentifié peut déclencher un envoi.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();
  const callerRole = callerProfile?.role as DbUserRole | undefined;
  if (!callerRole || !isEventStaff(mapDbRoleToAppRole(callerRole))) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalide.' }, { status: 400 });
  }

  const { userId, type, title, body, templateKey } = payload;
  if (!userId || !type || !title) {
    return NextResponse.json({ ok: false, error: 'userId, type et title requis.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Destinataire : e-mail (auth) + profil (nom + préférences).
  const { data: recipient, error: recipientErr } = await admin.auth.admin.getUserById(userId);
  if (recipientErr || !recipient?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Destinataire introuvable.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('users_profile')
    .select('prenom, nom, notification_preferences')
    .eq('id', userId)
    .maybeSingle();

  // Respect des préférences e-mail (défaut = valeurs par défaut de l'app).
  const prefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...((profile?.notification_preferences as NotificationPreferences | null) ?? {}),
  };
  const prefKey = TYPE_TO_EMAIL_PREF[type];
  if (prefKey && prefs[prefKey] === false) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'opted_out' }, { status: 200 });
  }

  // Lien absolu pour le bouton d'action.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || new URL(request.url).origin;
  const ctaUrl =
    payload.link || templateKey
      ? resolveEmailCtaUrl(base, {
          templateKey: templateKey ?? 'account_registration',
          variables: payload.variables,
          overrideLink: payload.link,
        })
      : undefined;
  const recipientName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || null;

  let finalSubject = title;
  let finalTitle = title;
  let finalBody = body ?? '';
  let finalCtaLabel = ctaUrl ? 'Ouvrir la plateforme' : undefined;

  if (templateKey) {
    const config = await fetchEmailTemplateConfig(admin);
    const template = config?.email_templates[templateKey];
    if (template?.enabled) {
      const rendered = renderEmailTemplate(template, {
        prenom: profile?.prenom ?? '',
        nom_complet: recipientName ?? '',
        email: recipient.user.email ?? '',
        lien_plateforme: base,
        ...(payload.variables ?? {}),
      });
      finalSubject = rendered.subject || finalSubject;
      finalTitle = rendered.title || finalTitle;
      finalBody = rendered.body || finalBody;
      finalCtaLabel = ctaUrl ? rendered.ctaLabel || finalCtaLabel : undefined;
    }
  }

  const html = renderNotificationEmail({
    title: finalTitle,
    body: finalBody,
    ctaLabel: finalCtaLabel,
    ctaUrl,
    recipientName,
  });

  const result = await sendEmail({
    to: recipient.user.email,
    subject: `JSAN 2025 — ${finalSubject}`,
    html,
    text: finalBody || finalSubject,
  });

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
