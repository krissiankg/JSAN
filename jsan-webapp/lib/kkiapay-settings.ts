import type { SupabaseClient } from '@supabase/supabase-js';

export interface KkiapayCredentials {
  publicKey: string;
  privateKey: string;
  secretKey: string;
  sandbox: boolean;
  source: 'database' | 'env' | 'none';
}

export interface KkiapayPublicConfig {
  publicKey: string;
  sandbox: boolean;
  configured: boolean;
}

export interface KkiapayAdminView {
  publicKey: string;
  privateKeyMasked: string | null;
  secretKeyMasked: string | null;
  privateKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  sandbox: boolean;
  autoMode: boolean;
  source: 'database' | 'env' | 'mixed' | 'none';
  envFallbackAvailable: boolean;
}

function maskSecret(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (v.length <= 8) return '••••••••';
  return `${'•'.repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

function envPublicKey(): string {
  return (process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY ?? '').trim();
}

function envPrivateKey(): string {
  return (process.env.KKIAPAY_PRIVATE_KEY ?? '').trim();
}

function envSecretKey(): string {
  return (process.env.KKIAPAY_SECRET ?? '').trim();
}

function envSandbox(): boolean {
  return (process.env.NEXT_PUBLIC_KKIAPAY_SANDBOX ?? '').toLowerCase() !== 'false';
}

/** Résout les clés : base de données en priorité, sinon variables d'environnement. */
export async function resolveKkiapayCredentials(
  admin: SupabaseClient
): Promise<KkiapayCredentials> {
  const { data } = await admin
    .from('kkiapay_settings')
    .select('public_key, private_key, secret_key, sandbox')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const dbPublic = (data?.public_key ?? '').trim();
  const dbPrivate = (data?.private_key ?? '').trim();
  const dbSecret = (data?.secret_key ?? '').trim();
  const hasDb = Boolean(dbPublic && dbPrivate && dbSecret);

  if (hasDb) {
    return {
      publicKey: dbPublic,
      privateKey: dbPrivate,
      secretKey: dbSecret,
      sandbox: data?.sandbox !== false,
      source: 'database',
    };
  }

  const publicKey = envPublicKey();
  const privateKey = envPrivateKey();
  const secretKey = envSecretKey();
  if (publicKey && privateKey && secretKey) {
    return {
      publicKey,
      privateKey,
      secretKey,
      sandbox: envSandbox(),
      source: 'env',
    };
  }

  // Partiel DB + env (ex. public en DB, secrets encore en env)
  const mergedPublic = dbPublic || publicKey;
  const mergedPrivate = dbPrivate || privateKey;
  const mergedSecret = dbSecret || secretKey;
  if (mergedPublic && mergedPrivate && mergedSecret) {
    return {
      publicKey: mergedPublic,
      privateKey: mergedPrivate,
      secretKey: mergedSecret,
      sandbox: data ? data.sandbox !== false : envSandbox(),
      source: 'database',
    };
  }

  return {
    publicKey: mergedPublic,
    privateKey: mergedPrivate,
    secretKey: mergedSecret,
    sandbox: data ? data.sandbox !== false : envSandbox(),
    source: 'none',
  };
}

export async function fetchKkiapayAdminView(
  supabase: SupabaseClient
): Promise<KkiapayAdminView> {
  const { data } = await supabase
    .from('kkiapay_settings')
    .select('public_key, private_key, secret_key, sandbox')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const dbPublic = (data?.public_key ?? '').trim();
  const dbPrivate = (data?.private_key ?? '').trim();
  const dbSecret = (data?.secret_key ?? '').trim();
  const envPub = envPublicKey();
  const envPriv = envPrivateKey();
  const envSec = envSecretKey();

  const publicKey = dbPublic || envPub;
  const privateConfigured = Boolean(dbPrivate || envPriv);
  const secretConfigured = Boolean(dbSecret || envSec);
  const autoMode = Boolean(publicKey && privateConfigured && secretConfigured);

  let source: KkiapayAdminView['source'] = 'none';
  if (dbPublic && dbPrivate && dbSecret) source = 'database';
  else if (envPub && envPriv && envSec && !dbPublic && !dbPrivate && !dbSecret) source = 'env';
  else if (autoMode) source = 'mixed';

  return {
    publicKey,
    privateKeyMasked: maskSecret(dbPrivate || (envPriv ? envPriv : null)),
    secretKeyMasked: maskSecret(dbSecret || (envSec ? envSec : null)),
    privateKeyConfigured: privateConfigured,
    secretKeyConfigured: secretConfigured,
    sandbox: data ? data.sandbox !== false : envSandbox(),
    autoMode,
    source,
    envFallbackAvailable: Boolean(envPub || envPriv || envSec),
  };
}

export async function updateKkiapaySettings(
  supabase: SupabaseClient,
  input: {
    publicKey?: string;
    privateKey?: string;
    secretKey?: string;
    sandbox?: boolean;
    clearPrivateKey?: boolean;
    clearSecretKey?: boolean;
  },
  updatedBy?: string | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('kkiapay_settings')
    .select('id, public_key, private_key, secret_key, sandbox')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy ?? null,
  };

  if (input.publicKey !== undefined) {
    payload.public_key = input.publicKey.trim() || null;
  }
  if (input.clearPrivateKey) {
    payload.private_key = null;
  } else if (input.privateKey !== undefined && input.privateKey.trim()) {
    payload.private_key = input.privateKey.trim();
  }
  if (input.clearSecretKey) {
    payload.secret_key = null;
  } else if (input.secretKey !== undefined && input.secretKey.trim()) {
    payload.secret_key = input.secretKey.trim();
  }
  if (input.sandbox !== undefined) {
    payload.sandbox = input.sandbox;
  }

  if (existing?.id) {
    const { error } = await supabase.from('kkiapay_settings').update(payload).eq('id', existing.id);
    return error?.message ?? null;
  }

  const { error } = await supabase.from('kkiapay_settings').insert({
    public_key: (input.publicKey ?? '').trim() || null,
    private_key: (input.privateKey ?? '').trim() || null,
    secret_key: (input.secretKey ?? '').trim() || null,
    sandbox: input.sandbox ?? true,
    updated_by: updatedBy ?? null,
  });
  return error?.message ?? null;
}

export async function fetchKkiapayPublicConfigFromRpc(
  supabase: SupabaseClient
): Promise<KkiapayPublicConfig> {
  const { data, error } = await supabase.rpc('get_kkiapay_public_config');
  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { public_key: string | null; sandbox: boolean; configured: boolean };
    const publicKey = (row.public_key ?? '').trim() || envPublicKey();
    return {
      publicKey,
      sandbox: row.sandbox !== false,
      configured: Boolean(publicKey) || Boolean(row.configured),
    };
  }

  // Fallback env (migration pas encore appliquée)
  const publicKey = envPublicKey();
  return {
    publicKey,
    sandbox: envSandbox(),
    configured: Boolean(publicKey && envPrivateKey() && envSecretKey()),
  };
}
