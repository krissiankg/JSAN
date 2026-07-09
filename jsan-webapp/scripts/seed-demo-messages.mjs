/**
 * Insère des messages de démo (2 conversations) pour prévisualiser la messagerie.
 * Usage: npm run seed:messages
 *
 * Requiert SUPABASE_SERVICE_ROLE_KEY dans .env.local
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

const AUTEUR_EMAIL = 'auteur@jsan-test.com';
const STAFF_EMAIL = 'organisateur@jsan-test.com';
const EVALUATOR_EMAIL = 'evaluateur@jsan-test.com';

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function minutesAgo(m) {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

async function findUserIdByEmail(client, email) {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

async function hasMessagesBetween(client, userA, userB) {
  const { data } = await client
    .from('messages')
    .select('id')
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function seed() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  }

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const auteurId = await findUserIdByEmail(client, AUTEUR_EMAIL);
  const staffId = await findUserIdByEmail(client, STAFF_EMAIL);
  const evaluatorId = await findUserIdByEmail(client, EVALUATOR_EMAIL);

  if (!auteurId) {
    console.error(`❌ Compte introuvable : ${AUTEUR_EMAIL} — lancez npm run seed:users`);
    process.exit(1);
  }
  if (!staffId) {
    console.error(`❌ Compte introuvable : ${STAFF_EMAIL} — lancez npm run seed:users`);
    process.exit(1);
  }

  let inserted = 0;

  const staffExists = await hasMessagesBetween(client, auteurId, staffId);
  if (!staffExists) {
    const { data: abstract } = await client
      .from('abstracts')
      .select('id, titre')
      .eq('author_id', auteurId)
      .neq('statut', 'Brouillon')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const abstractId = abstract?.id ?? null;

    const staffRows = [
      {
        sender_id: staffId,
        receiver_id: auteurId,
        abstract_id: abstractId,
        contenu: 'Bonjour, merci de bien vouloir uploader votre manuscrit final avant le 15 pour inclusion dans les actes.',
        is_read: true,
        created_at: hoursAgo(26),
      },
      {
        sender_id: auteurId,
        receiver_id: staffId,
        abstract_id: abstractId,
        contenu: "Bonjour, c'est noté. Avez-vous bien reçu mon manuscrit révisé déposé ce matin ?",
        is_read: true,
        created_at: minutesAgo(10),
      },
    ];

    const { error } = await client.from('messages').insert(staffRows);
    if (error) {
      console.error('❌ Erreur conversation organisateur :', error.message);
      process.exit(1);
    }
    inserted += staffRows.length;
    console.log(`✅ Conversation @org_jsan : ${staffRows.length} messages`);
  } else {
    console.log('⏭  Conversation organisateur déjà présente');
  }

  if (evaluatorId) {
    await client.from('users_profile').update({ nom: 'Laurent' }).eq('id', evaluatorId);

    const evalExists = await hasMessagesBetween(client, auteurId, evaluatorId);
    if (!evalExists) {
      const evalRows = [
        {
          sender_id: evaluatorId,
          receiver_id: auteurId,
          abstract_id: null,
          contenu: 'Super présentation hier !',
          is_read: false,
          created_at: hoursAgo(2),
        },
        {
          sender_id: auteurId,
          receiver_id: evaluatorId,
          abstract_id: null,
          contenu: 'Merci beaucoup pour votre retour positif !',
          is_read: true,
          created_at: hoursAgo(1.5),
        },
      ];
      const { error } = await client.from('messages').insert(evalRows);
      if (error) {
        console.error('❌ Erreur conversation évaluateur :', error.message);
      } else {
        inserted += evalRows.length;
        console.log(`✅ Conversation @mlaurent : ${evalRows.length} messages`);
      }
    } else {
      console.log('⏭  Conversation évaluateur déjà présente');
    }
  } else {
    console.log('⏭  Évaluateur absent — seule la conversation organisateur est créée');
  }

  if (inserted === 0) {
    console.log('\nAucun nouveau message. Connectez-vous avec auteur@jsan-test.com → Messagerie');
  } else {
    console.log(`\n✅ ${inserted} message(s) inséré(s). Ouvrez /dashboard/messagerie en tant qu'auteur.`);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
