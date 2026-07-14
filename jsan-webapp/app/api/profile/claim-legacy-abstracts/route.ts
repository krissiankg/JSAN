import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimLegacyAbstractsForUser,
  notifyLegacyAbstractsClaimed,
} from '@/lib/legacy-abstracts';

/** Revendique les résumés JSAN 2025 liés à l'e-mail du compte connecté. */
export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await claimLegacyAbstractsForUser(admin, auth.user.id, auth.user.email);
    if (result.claimed > 0) {
      await notifyLegacyAbstractsClaimed(admin, auth.user.id, result.claimed);
    }
    return NextResponse.json({
      ok: true,
      claimed: result.claimed,
      titles: result.titles,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Échec de la revendication.' },
      { status: 500 }
    );
  }
}
