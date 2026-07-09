import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email';
import { fetchEmailTemplateConfig, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';

type AllowedAccountTemplateKey = 'account_registration' | 'account_email_confirmation' | 'account_welcome';

interface Payload {
  userId?: string;
  recipientEmail?: string;
  templateKey?: AllowedAccountTemplateKey;
  link?: string | null;
  variables?: Record<string, string | null | undefined>;
}

const PUBLIC_TEMPLATE_KEYS: AllowedAccountTemplateKey[] = ['account_registration', 'account_email_confirmation'];

export async function POST(request: Request) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'email_not_configured' }, { status: 200 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalide.' }, { status: 400 });
  }

  const { userId, recipientEmail, templateKey, link, variables } = payload;
  if (!userId || !templateKey) {
    return NextResponse.json({ ok: false, error: 'userId et templateKey requis.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const caller = auth.user ?? null;
  const admin = createAdminClient();

  const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(userId);
  if (recipientError || !recipient?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Destinataire introuvable.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('users_profile')
    .select('prenom, nom, role, registration_email_sent_at, welcome_email_sent_at')
    .eq('id', userId)
    .maybeSingle();

  const isCallerSelf = caller?.id === userId;
  let isStaff = false;
  if (caller) {
    const { data: callerProfile } = await supabase.from('users_profile').select('role').eq('id', caller.id).maybeSingle();
    isStaff = Boolean(callerProfile?.role && isEventStaff(mapDbRoleToAppRole(callerProfile.role as DbUserRole)));
  }

  if (templateKey === 'account_welcome') {
    if (!caller || (!isCallerSelf && !isStaff)) {
      return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
    }
    if ((profile as { welcome_email_sent_at?: string | null } | null)?.welcome_email_sent_at) {
      return NextResponse.json({ ok: false, skipped: true, reason: 'already_sent' }, { status: 200 });
    }
  } else {
    if (!PUBLIC_TEMPLATE_KEYS.includes(templateKey)) {
      return NextResponse.json({ ok: false, error: 'Template non autorisé.' }, { status: 403 });
    }
    if (!recipientEmail || recipientEmail.trim().toLowerCase() !== recipient.user.email.trim().toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'Adresse destinataire incohérente.' }, { status: 403 });
    }
    const createdAt = new Date((recipient.user as { created_at?: string }).created_at ?? '');
    const ageMs = Date.now() - createdAt.getTime();
    if (!Number.isFinite(ageMs) || ageMs > 1000 * 60 * 30) {
      return NextResponse.json({ ok: false, error: 'Fenêtre d’envoi expirée.' }, { status: 403 });
    }
    if (
      templateKey === 'account_registration' &&
      (profile as { registration_email_sent_at?: string | null } | null)?.registration_email_sent_at
    ) {
      return NextResponse.json({ ok: false, skipped: true, reason: 'already_sent' }, { status: 200 });
    }
  }

  const config = await fetchEmailTemplateConfig(admin);
  const template = config?.email_templates[templateKey];
  if (!template?.enabled) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'template_disabled' }, { status: 200 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || new URL(request.url).origin;
  const ctaUrl = link ? `${base.replace(/\/$/, '')}${link}` : base;
  const recipientName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || null;
  const roleLabel =
    profile?.role === 'pair_en_attente'
      ? 'Évaluateur (en attente)'
      : profile?.role === 'pair_valide'
        ? 'Évaluateur'
        : profile?.role === 'auteur'
          ? 'Auteur'
          : profile?.role === 'organisateur'
            ? 'Organisateur'
            : profile?.role === 'superadmin' || profile?.role === 'admin'
              ? 'Super Admin'
              : 'Participant';

  const rendered = renderEmailTemplate(template, {
    prenom: profile?.prenom ?? '',
    nom_complet: recipientName ?? '',
    email: recipient.user.email,
    role_label: roleLabel,
    lien_plateforme: base,
    ...(variables ?? {}),
  });

  const html = renderNotificationEmail({
    title: rendered.title,
    body: rendered.body,
    ctaLabel: rendered.ctaLabel || 'Ouvrir la plateforme',
    ctaUrl,
    recipientName,
  });

  const result = await sendEmail({
    to: recipient.user.email,
    subject: `JSAN 2025 — ${rendered.subject}`,
    html,
    text: rendered.body || rendered.subject,
  });

  if (result.ok) {
    const update: Record<string, string> = {};
    if (templateKey === 'account_welcome') update.welcome_email_sent_at = new Date().toISOString();
    if (templateKey === 'account_registration') update.registration_email_sent_at = new Date().toISOString();
    if (Object.keys(update).length > 0) {
      await admin.from('users_profile').update(update).eq('id', userId);
    }
  }

  await admin.from('email_campaign_logs').insert({
    created_by: caller?.id ?? null,
    campaign_kind: 'account',
    template_key: templateKey,
    audience_label: templateKey,
    recipient_count: 1,
    sent_count: result.ok ? 1 : 0,
    failed_count: result.ok ? 0 : 1,
    metadata: {
      user_id: userId,
      skipped: result.skipped ?? false,
      link: link ?? null,
    },
  });

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
