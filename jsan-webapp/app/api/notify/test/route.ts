import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import { fetchEmailTemplateConfig, renderEmailTemplate, sampleVariablesForTemplate, type EmailTemplateKey } from '@/lib/email-templates';
import { resolveEmailCtaUrl } from '@/lib/email-template-links';
import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email';

interface Payload {
  templateKey?: EmailTemplateKey;
}

export async function POST(request: Request) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'email_not_configured' }, { status: 200 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from('users_profile')
    .select('role, prenom, nom')
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

  if (!payload.templateKey) {
    return NextResponse.json({ ok: false, error: 'templateKey requis.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const authUser = await admin.auth.admin.getUserById(auth.user.id);
  const to = authUser.data.user?.email;
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Adresse e-mail introuvable.' }, { status: 404 });
  }

  const config = await fetchEmailTemplateConfig(admin);
  const template = config?.email_templates[payload.templateKey];
  if (!template?.enabled) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'template_disabled' }, { status: 200 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || new URL(request.url).origin;
  const sample = sampleVariablesForTemplate(payload.templateKey);
  const rendered = renderEmailTemplate(template, {
    ...sample,
    prenom: callerProfile?.prenom ?? 'Admin',
    nom_complet: [callerProfile?.prenom, callerProfile?.nom].filter(Boolean).join(' ') || 'Admin JSAN',
    email: to,
    lien_plateforme: base,
  });

  const html = renderNotificationEmail({
    title: rendered.title,
    body: rendered.body,
    ctaLabel: rendered.ctaLabel || 'Ouvrir la plateforme',
    ctaUrl: resolveEmailCtaUrl(base, {
      templateKey: payload.templateKey,
      variables: sample,
    }),
    recipientName: [callerProfile?.prenom, callerProfile?.nom].filter(Boolean).join(' ') || null,
  });

  const result = await sendEmail({
    to,
    subject: `TEST JSAN 2025 — ${rendered.subject}`,
    html,
    text: rendered.body || rendered.subject,
  });

  await admin.from('email_campaign_logs').insert({
    created_by: auth.user.id,
    campaign_kind: 'test',
    template_key: payload.templateKey,
    audience_label: 'self-test',
    recipient_count: 1,
    sent_count: result.ok ? 1 : 0,
    failed_count: result.ok ? 0 : 1,
    metadata: {
      recipient: to,
    },
  });

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
