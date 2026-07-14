import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import { claimLegacyAbstractsForUser, notifyLegacyAbstractsClaimed } from '@/lib/legacy-abstracts';

async function requireStaff() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', auth.user.id).maybeSingle();
  const role = profile?.role as DbUserRole | undefined;
  if (!role || !isEventStaff(mapDbRoleToAppRole(role))) {
    return { error: NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 }) };
  }
  return { supabase };
}

/** Liste les résumés legacy (édition JSAN 2025). */
export async function GET() {
  const auth = await requireStaff();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('abstracts')
      .select('id, titre, thematique, statut, claim_email, author_id, legacy_id, edition, claimed_at, library_document_id, created_at')
      .eq('edition', 'JSAN 2025')
      .order('legacy_id', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const pending = rows.filter((r) => !r.author_id).length;
    const claimed = rows.filter((r) => Boolean(r.author_id)).length;

    return NextResponse.json({
      ok: true,
      stats: { total: rows.length, pending, claimed },
      abstracts: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Impossible de charger les résumés legacy.' },
      { status: 500 }
    );
  }
}

/** Relie manuellement un résumé legacy à un utilisateur (par userId ou e-mail). */
export async function POST(request: Request) {
  const auth = await requireStaff();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => null)) as {
      abstractId?: string;
      userId?: string;
      email?: string;
    } | null;

    const admin = createAdminClient();

    if (body?.email && !body.abstractId) {
      // Claim all pending for that email (admin-triggered)
      const email = body.email.trim().toLowerCase();
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const user = (users?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
      if (!user) {
        return NextResponse.json({ ok: false, error: 'Aucun compte avec cet e-mail.' }, { status: 404 });
      }
      const result = await claimLegacyAbstractsForUser(admin, user.id, email);
      if (result.claimed > 0) await notifyLegacyAbstractsClaimed(admin, user.id, result.claimed);
      return NextResponse.json({ ok: true, claimed: result.claimed, titles: result.titles });
    }

    if (!body?.abstractId || (!body.userId && !body.email)) {
      return NextResponse.json({ ok: false, error: 'abstractId et userId (ou email) requis.' }, { status: 400 });
    }

    let userId = body.userId ?? null;
    if (!userId && body.email) {
      const email = body.email.trim().toLowerCase();
      let page = 1;
      while (page <= 50 && !userId) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const found = (data?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
        if (found) userId = found.id;
        if ((data?.users ?? []).length < 200) break;
        page += 1;
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    const { error } = await admin
      .from('abstracts')
      .update({
        author_id: userId,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.abstractId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await notifyLegacyAbstractsClaimed(admin, userId, 1);
    return NextResponse.json({ ok: true, claimed: 1 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Échec du rattachement.' },
      { status: 500 }
    );
  }
}
