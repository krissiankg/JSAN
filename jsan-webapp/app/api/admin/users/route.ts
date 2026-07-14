import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import type { StaffUserRow } from '@/lib/users-admin';

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

async function fetchAuthEmailMap(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, { email: string; prenom: string | null; nom: string | null }>> {
  const map = new Map<string, { email: string; prenom: string | null; nom: string | null }>();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    for (const u of users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      map.set(u.id, {
        email: (u.email ?? '').trim(),
        prenom: typeof meta.prenom === 'string' ? meta.prenom : null,
        nom: typeof meta.nom === 'string' ? meta.nom : null,
      });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return map;
}

export async function GET() {
  const auth = await requireStaff();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const [{ data: profiles, error: profileError }, authMap] = await Promise.all([
      admin
        .from('users_profile')
        .select('id, nom, prenom, role, is_student_verified, is_member_verified, created_at, telephone')
        .order('created_at', { ascending: false }),
      fetchAuthEmailMap(admin),
    ]);

    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    const users: StaffUserRow[] = ((profiles ?? []) as Omit<StaffUserRow, 'email'>[]).map((profile) => {
      const authUser = authMap.get(profile.id);
      return {
        ...profile,
        prenom: profile.prenom?.trim() || authUser?.prenom || null,
        nom: profile.nom?.trim() || authUser?.nom || null,
        email: authUser?.email || null,
      };
    });

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Impossible de charger les utilisateurs.' },
      { status: 500 }
    );
  }
}
