import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEmailTemplateConfig, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';
import { resolveEmailCtaUrl } from '@/lib/email-template-links';
import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';

type BroadcastAudience = 'all' | 'participants' | 'authors' | 'evaluators' | 'organizers';

interface Payload {
  templateKey?: EmailTemplateKey;
  audience?: BroadcastAudience;
  link?: string | null;
  variables?: Record<string, string | null | undefined>;
  filters?: {
    paidOnly?: boolean;
    verifiedOnly?: boolean;
    ticketType?: string | null;
    userIds?: string[];
  };
}

function matchesAudience(role: DbUserRole, audience: BroadcastAudience): boolean {
  switch (audience) {
    case 'participants':
      return role === 'participant';
    case 'authors':
      return role === 'auteur';
    case 'evaluators':
      return role === 'pair_valide' || role === 'pair_en_attente';
    case 'organizers':
      return role === 'organisateur' || role === 'admin' || role === 'superadmin';
    case 'all':
    default:
      return true;
  }
}

function roleLabel(role: DbUserRole): string {
  return role === 'pair_en_attente'
    ? 'Évaluateur (en attente)'
    : role === 'pair_valide'
      ? 'Évaluateur'
      : role === 'auteur'
        ? 'Auteur'
        : role === 'organisateur'
          ? 'Organisateur'
          : role === 'superadmin' || role === 'admin'
            ? 'Super Admin'
            : 'Participant';
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
  const { data: callerProfile } = await supabase.from('users_profile').select('role').eq('id', auth.user.id).maybeSingle();
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

  const { templateKey, audience = 'all', link, variables = {}, filters } = payload;
  if (!templateKey) {
    return NextResponse.json({ ok: false, error: 'templateKey requis.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const config = await fetchEmailTemplateConfig(admin);
  const template = config?.email_templates[templateKey];
  if (!template?.enabled) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'template_disabled' }, { status: 200 });
  }

  const { data: users, error } = await admin
    .from('users_profile')
    .select('id, prenom, nom, role, is_student_verified, is_member_verified')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let paidUserIds = new Set<string>();
  if (filters?.paidOnly || filters?.ticketType) {
    const filterValue = filters?.ticketType?.trim() ?? '';
    const { data: tickets } = await admin
      .from('tickets_registrations')
      .select('user_id, type_billet, ticket_type_id')
      .eq('statut_paiement', 'Paye');

    const rows = ((tickets ?? []) as Array<{
      user_id: string | null;
      type_billet: string | null;
      ticket_type_id: string | null;
    }>).filter((row) => {
      if (!filterValue) return true;
      return row.ticket_type_id === filterValue || row.type_billet === filterValue;
    });

    paidUserIds = new Set(rows.map((row) => row.user_id).filter(Boolean) as string[]);
  }

  const directUserIds = filters?.userIds?.length ? new Set(filters.userIds) : null;
  const recipients = (
    (users ?? []) as Array<{
      id: string;
      prenom: string | null;
      nom: string | null;
      role: DbUserRole;
      is_student_verified?: boolean | null;
      is_member_verified?: boolean | null;
    }>
  ).filter((user) => {
    if (!matchesAudience(user.role, audience)) return false;
    if (directUserIds && !directUserIds.has(user.id)) return false;
    if (filters?.verifiedOnly && !(user.is_student_verified || user.is_member_verified)) return false;
    if ((filters?.paidOnly || filters?.ticketType) && !paidUserIds.has(user.id)) return false;
    return true;
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || new URL(request.url).origin;
  const ctaUrl = resolveEmailCtaUrl(base, {
    templateKey,
    variables,
    overrideLink: link,
  });

  let sent = 0;
  let failed = 0;

  for (const user of recipients) {
    const authUser = await admin.auth.admin.getUserById(user.id);
    const to = authUser.data.user?.email;
    if (!to) {
      failed += 1;
      continue;
    }
    const fullName = [user.prenom, user.nom].filter(Boolean).join(' ').trim();
    const rendered = renderEmailTemplate(template, {
      prenom: user.prenom ?? '',
      nom_complet: fullName,
      email: to,
      role_label: roleLabel(user.role),
      lien_plateforme: base,
      ...(variables ?? {}),
    });
    const html = renderNotificationEmail({
      title: rendered.title,
      body: rendered.body,
      ctaLabel: rendered.ctaLabel || 'Ouvrir la plateforme',
      ctaUrl,
      recipientName: fullName || null,
    });
    const result = await sendEmail({
      to,
      subject: `JSAN 2025 — ${rendered.subject}`,
      html,
      text: rendered.body || rendered.subject,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  await admin.from('email_campaign_logs').insert({
    created_by: auth.user.id,
    campaign_kind: 'broadcast',
    template_key: templateKey,
    audience_label: audience,
    recipient_count: recipients.length,
    sent_count: sent,
    failed_count: failed,
    metadata: {
      link: link ?? null,
      filters: filters ?? {},
      variables,
    },
  });

  return NextResponse.json({ ok: true, sent, failed, audience }, { status: 200 });
}
