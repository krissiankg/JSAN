/**
 * Crée les comptes de test JSAN dans Supabase Auth + users_profile.
 * Usage: npm run seed:users
 *
 * Préfère SUPABASE_SERVICE_ROLE_KEY (admin) pour éviter le rate limit.
 * Clé : Supabase → Project Settings → API → service_role (secret)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=').map((s, i, arr) => (i === 0 ? s.trim() : arr.slice(1).join('=').trim())))
);

const PASSWORD = 'Test@JSAN2025';

const TEST_USERS = [
  { email: 'participant@jsan-test.com', role: 'participant', prenom: 'Paul', nom: 'Participant', label: 'Participant' },
  { email: 'auteur@jsan-test.com', role: 'auteur', prenom: 'Alice', nom: 'Auteur', institution: "Université d'Abomey-Calavi", label: 'Auteur' },
  { email: 'evaluateur@jsan-test.com', role: 'pair_valide', prenom: 'Martin', nom: 'Laurent', specialite: 'Nutrition clinique', label: 'Évaluateur (validé)' },
  { email: 'evaluateur-attente@jsan-test.com', role: 'pair_en_attente', prenom: 'Sophie', nom: 'EnAttente', specialite: 'Sécurité sanitaire', label: 'Évaluateur (en attente)' },
  { email: 'organisateur@jsan-test.com', role: 'organisateur', prenom: 'Colette', nom: 'Organisateur', label: 'Organisateur' },
  { email: 'superadmin@jsan-test.com', role: 'superadmin', prenom: 'Admin', nom: 'Super', label: 'Super Admin' },
];

function loadClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant dans .env.local');

  if (serviceKey) {
    console.log('Mode : Admin API (service_role) — pas de rate limit\n');
    return {
      admin: true,
      client: createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    };
  }

  console.log('Mode : signUp public (anon) — peut être bloqué par rate limit');
  console.log('Astuce : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local\n');
  return {
    admin: false,
    client: createClient(url, anonKey),
  };
}

async function createUserAdmin(client, user) {
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      institution: user.institution ?? null,
      specialite: user.specialite ?? null,
    },
  });
  return { data, error };
}

async function createUserPublic(client, user) {
  return client.auth.signUp({
    email: user.email,
    password: PASSWORD,
    options: {
      data: {
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        institution: user.institution ?? null,
        specialite: user.specialite ?? null,
      },
    },
  });
}

async function seed() {
  console.log('Création des comptes de test JSAN...\n');
  const { admin, client } = loadClient();

  for (const user of TEST_USERS) {
    const { data, error } = admin
      ? await createUserAdmin(client, user)
      : await createUserPublic(client, user);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        console.log(`⏭  ${user.label}: ${user.email} — existe déjà`);
      } else {
        console.error(`❌ ${user.label}: ${error.message}`);
      }
      continue;
    }

    if (data?.user) {
      console.log(`✅ ${user.label}: ${user.email} (rôle: ${user.role})`);
    }
  }

  console.log('\n--- Identifiants de connexion ---');
  console.log(`Mot de passe commun : ${PASSWORD}`);
  console.log('\nComptes :');
  for (const u of TEST_USERS) {
    console.log(`  • ${u.label.padEnd(22)} → ${u.email}`);
  }
}

seed().catch(console.error);
