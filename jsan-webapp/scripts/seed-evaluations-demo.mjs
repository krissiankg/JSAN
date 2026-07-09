/**
 * Insère résumés et manuscrits de démo pour tester le flux évaluateur.
 * Usage: npm run seed:evaluations
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
const EVALUATOR_EMAIL = 'evaluateur@jsan-test.com';
const SEED_MARKER = 'seed-eval-demo';

function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

async function findUserIdByEmail(client, email) {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

async function hasSeedData(client, authorId) {
  const { data } = await client
    .from('abstracts')
    .select('id')
    .eq('author_id', authorId)
    .ilike('mots_cles', `%${SEED_MARKER}%`)
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
  const evaluatorId = await findUserIdByEmail(client, EVALUATOR_EMAIL);

  if (!auteurId) {
    console.error(`❌ Compte introuvable : ${AUTEUR_EMAIL} — lancez npm run seed:users`);
    process.exit(1);
  }
  if (!evaluatorId) {
    console.error(`❌ Compte introuvable : ${EVALUATOR_EMAIL} — lancez npm run seed:users`);
    process.exit(1);
  }

  if (await hasSeedData(client, auteurId)) {
    console.log('⏭  Données d\'évaluation démo déjà présentes.');
    console.log('\nConnectez-vous avec evaluateur@jsan-test.com → Résumés / Articles à évaluer');
    return;
  }

  const keywords = `nutrition, santé publique, ${SEED_MARKER}`;

  // ——— Résumés (page « Résumés à évaluer ») ———

  const abstractA = {
    author_id: auteurId,
    titre: "Impact de la nutrition sur les maladies cardiovasculaires en Afrique de l'Ouest",
    contenu_texte:
      "Ce résumé présente une étude approfondie sur les habitudes alimentaires en Afrique de l'Ouest et leur corrélation directe avec l'augmentation des maladies cardiovasculaires. La méthodologie repose sur une cohorte de 5000 participants suivis sur 5 ans dans trois pays de la sous-région. Les résultats préliminaires montrent une association significative entre la consommation d'aliments ultra-transformés et l'incidence des pathologies cardiométaboliques.",
    mots_cles: keywords,
    thematique: 'Maladies Métaboliques',
    type_presentation_global: 'Oral',
    statut: 'Soumis',
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
  };

  const abstractB = {
    author_id: auteurId,
    titre: 'Nouveaux additifs alimentaires locaux et sécurité sanitaire',
    contenu_texte:
      "Une analyse toxicologique des nouveaux conservateurs naturels issus de plantes locales. Les résultats préliminaires montrent une efficacité de conservation comparable aux additifs synthétiques sans effets secondaires majeurs in vitro. L'étude évalue également la stabilité microbiologique sur 12 mois.",
    mots_cles: keywords,
    thematique: 'Sécurité Sanitaire',
    type_presentation_global: 'Poster',
    statut: 'En_Evaluation',
    created_at: daysAgo(14),
    updated_at: daysAgo(10),
  };

  const abstractC = {
    author_id: auteurId,
    titre: 'Biofortification du manioc en vitamine A : défis et perspectives',
    contenu_texte:
      "Revue systématique de la biofortification du manioc. L'étude met en évidence les défis d'acceptabilité par les populations locales malgré les avantages nutritionnels évidents pour lutter contre la carence en vitamine A. Des recommandations opérationnelles sont proposées pour les programmes de nutrition publique.",
    mots_cles: keywords,
    thematique: 'Malnutrition',
    type_presentation_global: 'Oral',
    statut: 'En_Evaluation',
    created_at: daysAgo(20),
    updated_at: daysAgo(5),
  };

  const { data: insertedAbstracts, error: absErr } = await client
    .from('abstracts')
    .insert([abstractA, abstractB, abstractC])
    .select('id, titre');

  if (absErr) {
    console.error('❌ Erreur insertion résumés :', absErr.message);
    process.exit(1);
  }

  const byTitle = Object.fromEntries(insertedAbstracts.map((a) => [a.titre, a.id]));
  const idA = byTitle[abstractA.titre];
  const idB = byTitle[abstractB.titre];
  const idC = byTitle[abstractC.titre];

  await client.from('abstract_authors').insert([
    {
      abstract_id: idA,
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'auteur@jsan-test.com',
      affiliation: "Université d'Abomey-Calavi",
      est_orateur: true,
      ordre_affichage: 1,
    },
    {
      abstract_id: idB,
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'auteur@jsan-test.com',
      affiliation: "Université d'Abomey-Calavi",
      est_orateur: true,
      ordre_affichage: 1,
    },
    {
      abstract_id: idC,
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'auteur@jsan-test.com',
      affiliation: "Université d'Abomey-Calavi",
      est_orateur: true,
      ordre_affichage: 1,
    },
  ]);

  // Review « En cours » sur résumé B
  await client.from('reviews').insert({
    abstract_id: idB,
    reviewer_id: evaluatorId,
    scores: { originalite: 3, methodologie: 2, pertinence: 4, qualite: 2.5 },
    commentaires_auteurs: 'Analyse prometteuse, merci de préciser la méthodologie toxicologique.',
    statut: 'En_Attente',
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
  });

  // Review « Évalué » sur résumé C
  await client.from('reviews').insert({
    abstract_id: idC,
    reviewer_id: evaluatorId,
    scores: {
      originalite: 4,
      methodologie: 5,
      pertinence: 4,
      qualite: 4.5,
      recommandation: 'accept',
    },
    commentaires_auteurs:
      'Travail solide et bien structuré. La revue systématique est pertinente pour le thème malnutrition.',
    statut: 'Complete',
    created_at: daysAgo(6),
    updated_at: daysAgo(4),
  });

  console.log('✅ 3 résumés de démo (À évaluer / En cours / Évalué)');

  // ——— Manuscrits (page « Articles à évaluer ») ———

  const abstractD = {
    author_id: auteurId,
    titre: "Impact de la nutrition sur les maladies cardiovasculaires en Afrique de l'Ouest — Manuscrit complet",
    contenu_texte: abstractA.contenu_texte,
    mots_cles: `${keywords}, manuscrit`,
    thematique: 'Maladies Métaboliques',
    type_presentation_global: 'Oral',
    statut: 'Accepte',
    created_at: daysAgo(30),
    updated_at: daysAgo(8),
  };

  const abstractE = {
    author_id: auteurId,
    titre: 'Biofortification du manioc en vitamine A — Manuscrit complet',
    contenu_texte: abstractC.contenu_texte,
    mots_cles: `${keywords}, manuscrit`,
    thematique: 'Malnutrition',
    type_presentation_global: 'Oral',
    statut: 'Accepte',
    created_at: daysAgo(35),
    updated_at: daysAgo(12),
  };

  const { data: acceptedAbstracts, error: accErr } = await client
    .from('abstracts')
    .insert([abstractD, abstractE])
    .select('id, titre');

  if (accErr) {
    console.error('❌ Erreur insertion résumés acceptés :', accErr.message);
    process.exit(1);
  }

  const accByTitle = Object.fromEntries(acceptedAbstracts.map((a) => [a.titre, a.id]));
  const idD = accByTitle[abstractD.titre];
  const idE = accByTitle[abstractE.titre];

  const { data: articles, error: artErr } = await client
    .from('full_articles')
    .insert([
      {
        abstract_id: idD,
        author_id: auteurId,
        titre: abstractD.titre,
        mots_cles: keywords,
        declaration_conflit: true,
        declaration_plagiat: true,
        statut: 'Soumis',
        created_at: daysAgo(5),
        updated_at: daysAgo(5),
      },
      {
        abstract_id: idE,
        author_id: auteurId,
        titre: abstractE.titre,
        mots_cles: keywords,
        declaration_conflit: true,
        declaration_plagiat: true,
        statut: 'En_Evaluation',
        created_at: daysAgo(10),
        updated_at: daysAgo(3),
      },
    ])
    .select('id, titre');

  if (artErr) {
    const hint = artErr.message.includes('full_articles')
      ? ' — exécutez la migration 012 dans Supabase.'
      : '';
    console.error(`❌ Erreur insertion manuscrits :${artErr.message}${hint}`);
    process.exit(1);
  }

  const artByTitle = Object.fromEntries(articles.map((a) => [a.titre, a.id]));

  await client.from('full_article_files').insert([
    {
      full_article_id: artByTitle[abstractD.titre],
      file_url: `${auteurId}/demo/Manuscrit_Complet_ART-012.pdf`,
      file_name: 'Manuscrit_Complet_ART-012.pdf',
      file_type: 'pdf',
      file_size_mb: 4.2,
      type_document: 'Manuscrit_Principal',
    },
    {
      full_article_id: artByTitle[abstractE.titre],
      file_url: `${auteurId}/demo/Manuscrit_Complet_ART-008.docx`,
      file_name: 'Manuscrit_Complet_ART-008.docx',
      file_type: 'docx',
      file_size_mb: 1.8,
      type_document: 'Manuscrit_Principal',
    },
  ]);

  // Review « Évalué » sur manuscrit E (liée à abstract_id du résumé parent)
  await client.from('reviews').insert({
    abstract_id: idE,
    reviewer_id: evaluatorId,
    scores: {
      originalite: 4,
      methodologie: 4,
      pertinence: 5,
      qualite: 4,
      recommandation: 'publish',
    },
    commentaires_admin_secrets: 'Manuscrit de bonne qualité, publication recommandée dans les actes.',
    commentaires_auteurs:
      'Le manuscrit est bien rédigé. Quelques corrections mineures sur la discussion seraient souhaitables avant publication.',
    statut: 'Complete',
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
  });

  console.log('✅ 2 manuscrits de démo (À évaluer / Évalué)');

  console.log('\n✅ Seed terminé. Testez avec :');
  console.log('   evaluateur@jsan-test.com / Test@JSAN2025');
  console.log('   → /dashboard/resumes-a-evaluer (3 lignes)');
  console.log('   → /dashboard/articles-a-evaluer (2 lignes)');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
