import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNewsletterCampaign } from '@/lib/newsletter-send';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';

interface Payload {
  message?: string;
  link?: string;
  subjectHint?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', auth.user.id).maybeSingle();
  const role = profile?.role as DbUserRole | undefined;
  if (!role || !isEventStaff(mapDbRoleToAppRole(role))) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalide.' }, { status: 400 });
  }

  const message = (payload.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: 'Message requis.' }, { status: 400 });
  }

  const link = (payload.link ?? '/blog').trim() || '/blog';
  const admin = createAdminClient();
  const result = await sendNewsletterCampaign({
    supabase: admin,
    createdBy: auth.user.id,
    templateKey: 'newsletter_campaign',
    variables: {
      message_newsletter: message,
      nom_evenement: 'JSAN',
      lien_plateforme: link,
    },
    link,
    campaignKind: 'newsletter',
    audienceLabel: 'newsletter_subscribers',
    metadata: { subjectHint: payload.subjectHint ?? null },
  });

  if (result.skipped) {
    return NextResponse.json({ ok: false, skipped: true, reason: result.reason }, { status: 200 });
  }

  return NextResponse.json({
    ok: result.ok,
    sent: result.sent,
    failed: result.failed,
    recipientCount: result.recipientCount,
  });
}
