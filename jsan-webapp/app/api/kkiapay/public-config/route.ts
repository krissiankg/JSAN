import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { fetchKkiapayPublicConfigFromRpc } from '@/lib/kkiapay-settings';

/** Config publique pour le widget billetterie (clé publique + sandbox uniquement). */
export async function GET() {
  const supabase = await createClient();
  const config = await fetchKkiapayPublicConfigFromRpc(supabase);
  return NextResponse.json({
    ok: true,
    publicKey: config.publicKey,
    sandbox: config.sandbox,
    configured: Boolean(config.publicKey),
  });
}
