import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { subscribeNewsletterViaRpc } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { email?: string; source?: string };
  try {
    body = (await request.json()) as { email?: string; source?: string };
  } catch {
    return NextResponse.json({ ok: false, message: 'Requête invalide.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) {
    return NextResponse.json({ ok: false, message: 'Adresse e-mail requise.' }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await subscribeNewsletterViaRpc(supabase, email, body.source ?? 'footer');

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
