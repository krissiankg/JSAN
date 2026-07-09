/**
 * Importe les utilisateurs WordPress depuis le CSV racine du dépôt.
 *
 * Règles de rôles (Etn-customer et Etn-speaker ignorés) :
 *   Respo / Etn-organizer → organisateur
 *   Editor              → pair_valide
 *   Subscriber+Customer → participant
 *   Subscriber seul     → auteur
 *
 * Aucun e-mail n'est envoyé. Les utilisateurs devront utiliser
 * « Mot de passe oublié » quand vous lancerez la campagne.
 *
 * Usage :
 *   npm run import:wordpress-users              # simulation (dry-run)
 *   npm run import:wordpress-users -- --execute # import réel
 *   npm run import:wordpress-users -- --execute --update-existing
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const csvPath = resolve(__dirname, '../../Tous les utilisateurs.csv');

const IGNORED_WP_ROLES = new Set(['etn-customer', 'etn-speaker']);
const EXECUTE = process.argv.includes('--execute');
const UPDATE_EXISTING = process.argv.includes('--update-existing');

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

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

function normalizeEmail(value) {
  return (value ?? '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value) {
  const trimmed = (value ?? '').trim();
  return trimmed === '' || trimmed.toUpperCase() === 'NA' ? '' : trimmed;
}

function parseWpRoles(roleString) {
  return (roleString ?? '')
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function hasRole(roles, name) {
  const target = name.toLowerCase();
  return roles.some((role) => role === target);
}

function mapWpRolesToJsan(roleString) {
  const rawRoles = parseWpRoles(roleString);
  const roles = rawRoles.filter((role) => !IGNORED_WP_ROLES.has(role));

  if (hasRole(rawRoles, 'administrator')) {
    return { skip: true, reason: 'administrator' };
  }

  if (hasRole(roles, 'respo') || hasRole(roles, 'etn-organizer')) {
    return { role: 'organisateur', roles };
  }

  if (hasRole(roles, 'editor')) {
    return { role: 'pair_valide', roles };
  }

  if (hasRole(roles, 'customer')) {
    return { role: 'participant', roles };
  }

  if (hasRole(roles, 'subscriber')) {
    return { role: 'auteur', roles };
  }

  return { skip: true, reason: 'no_mappable_role', roles };
}

function randomPassword() {
  return randomBytes(24).toString('base64url');
}

const fileEnv = loadEnvFile();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.');
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loadExistingUsersByEmail() {
  const map = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users) {
      const email = normalizeEmail(user.email);
      if (email) map.set(email, user);
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  return map;
}

function rowToUser(headers, values) {
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  const email = normalizeEmail(record['User Email']);
  const mapping = mapWpRolesToJsan(record['User Roles']);

  return {
    wpUserId: cleanText(record['User Id']),
    email,
    titre: cleanText(record.Titre),
    prenom: cleanText(record.Prénom),
    nom: cleanText(record['Nom de famille']),
    telephone: cleanText(record.Téléphone),
    wpRoles: record['User Roles'] ?? '',
    mapping,
  };
}

async function upsertProfile(userId, user, role) {
  const { error } = await client.from('users_profile').upsert(
    {
      id: userId,
      role,
      prenom: user.prenom || null,
      nom: user.nom || null,
      telephone: user.telephone || null,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

async function createAuthUser(user, role) {
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      role,
      prenom: user.prenom || null,
      nom: user.nom || null,
      telephone: user.telephone || null,
      wp_user_id: user.wpUserId || null,
      wp_roles: user.wpRoles,
      imported_from: 'wordpress',
    },
  });

  if (error) throw error;
  return data.user;
}

async function updateExistingUser(existing, user, role) {
  const { error: authError } = await client.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    user_metadata: {
      ...existing.user_metadata,
      role,
      prenom: user.prenom || null,
      nom: user.nom || null,
      telephone: user.telephone || null,
      wp_user_id: user.wpUserId || null,
      wp_roles: user.wpRoles,
      imported_from: 'wordpress',
    },
  });
  if (authError) throw authError;
  await upsertProfile(existing.id, user, role);
}

async function main() {
  const csvContent = readFileSync(csvPath, 'utf8');
  const table = parseCsv(csvContent);
  const headers = table[0];
  const dataRows = table.slice(1);

  const byEmail = new Map();
  for (const values of dataRows) {
    const user = rowToUser(headers, values);
    if (!user.email) continue;
    byEmail.set(user.email, user);
  }

  const users = Array.from(byEmail.values());
  const existingByEmail = EXECUTE ? await loadExistingUsersByEmail() : new Map();

  const report = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    source: csvPath,
    totals: {
      parsed: dataRows.length,
      uniqueEmails: users.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    skipped: [],
    errors: [],
    preview: [],
  };

  console.log(EXECUTE ? '▶ Import WordPress (EXÉCUTION)\n' : '▶ Simulation import WordPress (dry-run)\n');
  console.log(`Fichier : ${csvPath}`);
  console.log(`Lignes CSV : ${dataRows.length} | E-mails uniques : ${users.length}\n`);

  for (const user of users) {
    const line = `${user.email}`;

    if (!isValidEmail(user.email)) {
      report.totals.skipped += 1;
      report.skipped.push({ email: user.email, reason: 'invalid_email', wpRoles: user.wpRoles });
      console.log(`⏭  ${line} — e-mail invalide`);
      continue;
    }

    if (user.mapping.skip) {
      report.totals.skipped += 1;
      report.skipped.push({
        email: user.email,
        reason: user.mapping.reason,
        wpRoles: user.wpRoles,
      });
      console.log(`⏭  ${line} — ignoré (${user.mapping.reason})`);
      continue;
    }

    const role = user.mapping.role;
    const existing = existingByEmail.get(user.email);

    if (existing && !UPDATE_EXISTING) {
      report.totals.skipped += 1;
      report.skipped.push({ email: user.email, reason: 'already_exists', wpRoles: user.wpRoles });
      console.log(`⏭  ${line} — existe déjà`);
      continue;
    }

    report.preview.push({
      email: user.email,
      role,
      prenom: user.prenom,
      nom: user.nom,
      wpRoles: user.wpRoles,
      action: existing ? 'update' : 'create',
    });

    if (!EXECUTE) {
      console.log(`${existing ? '↻' : '＋'} ${line} → ${role}`);
      if (existing) report.totals.updated += 1;
      else report.totals.created += 1;
      continue;
    }

    try {
      if (existing) {
        await updateExistingUser(existing, user, role);
        report.totals.updated += 1;
        console.log(`↻  ${line} → ${role} (mis à jour)`);
      } else {
        const created = await createAuthUser(user, role);
        if (!created) throw new Error('Création auth sans utilisateur retourné');
        await upsertProfile(created.id, user, role);
        report.totals.created += 1;
        console.log(`✅ ${line} → ${role}`);
      }
    } catch (error) {
      report.totals.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push({ email: user.email, message, wpRoles: user.wpRoles });
      console.log(`❌ ${line} — ${message}`);
    }
  }

  const reportPath = resolve(
    __dirname,
    `../import-wordpress-users-report-${EXECUTE ? 'execute' : 'dry-run'}.json`
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Résumé ---');
  console.log(`Créés     : ${report.totals.created}`);
  console.log(`Mis à jour: ${report.totals.updated}`);
  console.log(`Ignorés   : ${report.totals.skipped}`);
  console.log(`Erreurs   : ${report.totals.errors}`);
  console.log(`Rapport   : ${reportPath}`);

  if (!EXECUTE) {
    console.log('\nPour lancer l’import réel : npm run import:wordpress-users -- --execute');
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
