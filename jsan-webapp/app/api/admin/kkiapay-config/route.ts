import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import { fetchKkiapayAdminView, updateKkiapaySettings } from '@/lib/kkiapay-settings';

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
  return { supabase, userId: auth.user.id };
}

export async function GET() {
  const auth = await requireStaff();
  if ('error' in auth && auth.error) return auth.error;

  const view = await fetchKkiapayAdminView(auth.supabase!);
  return NextResponse.json({ ok: true, config: view });
}

export async function PUT(request: Request) {
  const auth = await requireStaff();
  if ('error' in auth && auth.error) return auth.error;

  let body: {
    publicKey?: string;
    privateKey?: string;
    secretKey?: string;
    sandbox?: boolean;
    clearPrivateKey?: boolean;
    clearSecretKey?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalide.' }, { status: 400 });
  }

  const error = await updateKkiapaySettings(
    auth.supabase!,
    {
      publicKey: body.publicKey,
      privateKey: body.privateKey,
      secretKey: body.secretKey,
      sandbox: body.sandbox,
      clearPrivateKey: body.clearPrivateKey,
      clearSecretKey: body.clearSecretKey,
    },
    auth.userId
  );

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const view = await fetchKkiapayAdminView(auth.supabase!);
  return NextResponse.json({ ok: true, config: view });
}
