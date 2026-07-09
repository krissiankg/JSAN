/**
 * Crée ou met à jour un compte superadmin.
 *
 * Usage (ne pas committer le mot de passe) :
 *   $env:ADMIN_EMAIL="vous@exemple.com"
 *   $env:ADMIN_PASSWORD="votre-mot-de-passe"
 *   npm run create:superadmin
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

function loadEnvFile() {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    return Object.fromEntries(
      envContent
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=');
          if (idx === -1) return null;
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
        .filter(Boolean)
    );
  } catch {
    return {};
  }
}

const fileEnv = loadEnvFile();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const prenom = (process.env.ADMIN_PRENOM || 'Super').trim();
const nom = (process.env.ADMIN_NOM || 'Admin').trim();

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.');
  process.exit(1);
}

if (!email || !password) {
  console.error('❌ ADMIN_EMAIL et ADMIN_PASSWORD requis (variables d’environnement).');
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error: updateAuthError } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...existing.user_metadata,
        role: 'superadmin',
        prenom,
        nom,
      },
    });
    if (updateAuthError) throw updateAuthError;

    const { error: profileError } = await client
      .from('users_profile')
      .upsert({
        id: existing.id,
        role: 'superadmin',
        prenom,
        nom,
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    console.log(`✅ Compte superadmin mis à jour : ${email}`);
    return;
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'superadmin',
      prenom,
      nom,
    },
  });

  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await client
      .from('users_profile')
      .upsert({
        id: data.user.id,
        role: 'superadmin',
        prenom,
        nom,
      }, { onConflict: 'id' });

    if (profileError) throw profileError;
  }

  console.log(`✅ Compte superadmin créé : ${email}`);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
