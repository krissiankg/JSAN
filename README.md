# JSAN — Journées Scientifiques de l'Alimentation et de la Nutrition

Plateforme web officielle des **JSAN**, organisées par la **Société de Nutrition du Bénin (SNB)**.

**Site en production :** [https://snb-jsan.bj/](https://snb-jsan.bj/)

Les JSAN constituent un rendez-vous scientifique majeur autour de l'alimentation et de la nutrition en Afrique : soumissions de résumés et d'articles, comité de lecture, billetterie, programme, attestations et communication avec les participants.

---

## À propos du projet

Ce dépôt regroupe l'application web Next.js et le schéma Supabase qui pilotent la plateforme JSAN : site vitrine, espace participant, parcours auteur, évaluation par les pairs, administration événementielle et outils de communication.

### Fonctionnalités principales

| Domaine | Description |
|---------|-------------|
| **Site public** | Page d'accueil, tarifs, partenaires, FAQ, liens vers inscription et connexion |
| **Inscription & comptes** | Participant, auteur, candidature évaluateur — avec ouverture/fermeture des inscriptions depuis l'admin |
| **Soumissions scientifiques** | Résumés, articles complets, guides officiels (PDF/Word), suivi des statuts |
| **Peer review** | Attribution des évaluations, grilles, notes confidentielles organisateur, RLS renforcé |
| **Billetterie** | Billets par catégorie, liens de paiement Kkiapay, historique des achats |
| **Administration** | Soumissions, évaluateurs, programme, salles, sponsors, utilisateurs, rapports |
| **E-mails** | Modèles personnalisables (Resend), campagnes, historique des envois |
| **Attestations** | Création staff, période de téléchargement ouverte/fermée |
| **Bibliothèque** | Documents partagés avec les utilisateurs |
| **Maintenance** | Mode maintenance global + message public, avec accès staff conservé |

### Rôles utilisateur

- **Participant** — billetterie, profil, justificatifs (étudiant / membre SNB)
- **Auteur** — soumission et suivi des résumés et articles
- **Évaluateur** — relecture des travaux assignés (après validation)
- **Organisateur / Super admin** — pilotage complet de l'événement

---

## Structure du dépôt

```
JSAN/
├── jsan-webapp/          # Application Next.js 16 (App Router)
│   ├── app/              # Pages, API routes, dashboard
│   ├── components/       # Composants React
│   ├── lib/              # Logique métier, Supabase, e-mails, etc.
│   ├── scripts/          # Seeds, import WordPress, super admin
│   └── public/           # Assets statiques
├── backend/
│   ├── schema.sql        # Schéma de référence
│   └── migrations/       # Migrations SQL (001 → 029)
├── docs/                 # Documentation technique de suivi
├── media/                # Médias du site
└── assets/               # Ressources graphiques
```

---

## Stack technique

- **Frontend** — [Next.js 16](https://nextjs.org/), React 19, TypeScript
- **Backend / BDD** — [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, RLS)
- **Paiements** — [Kkiapay](https://kkiapay.me/) (liens par billet + webhook)
- **E-mails** — [Resend](https://resend.com/)
- **Hébergement cible** — Netlify (ou équivalent Node.js) + Supabase Storage pour les fichiers

---

## Démarrage local

### Prérequis

- Node.js 20+
- Un projet Supabase configuré
- Les migrations SQL appliquées dans l'ordre (`backend/migrations/`)

### Installation

```bash
cd jsan-webapp
cp .env.example .env.local
npm install
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

### Variables d'environnement

Copier `jsan-webapp/.env.example` vers `.env.local` et renseigner :

| Variable | Usage |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts serveur (ne jamais exposer côté client) |
| `NEXT_PUBLIC_KKIAPAY_*` / `KKIAPAY_*` | Paiements |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envoi d'e-mails |
| `NEXT_PUBLIC_APP_URL` | URL publique (ex. `https://snb-jsan.bj`) |

Variables optionnelles d'urgence : `MAINTENANCE_MODE`, `REGISTRATIONS_CLOSED`.

### Scripts utiles

```bash
npm run dev              # Serveur de développement
npm run build            # Build production
npm run seed:users       # Comptes de test (*@jsan-test.com)
npm run create:superadmin
npm run import:wordpress-users
```

---

## Base de données

Les migrations se trouvent dans `backend/migrations/`. Les exécuter dans le **SQL Editor Supabase**, dans l'ordre numérique, jusqu'à la dernière version (`029_registrations_open.sql`).

Points clés :

- **RLS** activé sur les tables sensibles (`users_profile`, résumés, reviews, messages…)
- **Storage** : buckets pour pièces jointes, logos sponsors, documents événement
- **RPC publiques** : `get_site_maintenance()`, `get_registrations_status()`

---

## Déploiement

1. Appliquer toutes les migrations Supabase en production.
2. Configurer les variables d'environnement sur l'hébergeur.
3. Déployer le dossier `jsan-webapp` (`npm run build` + `npm start` ou build Netlify).
4. Pointer le domaine **[snb-jsan.bj](https://snb-jsan.bj/)** vers l'hébergement.
5. Vérifier Resend (domaine d'envoi) et Kkiapay (webhook `/api/kkiapay/webhook`).

---

## Documentation complémentaire

- [`docs/AUTEUR-DASHBOARD-SUIVI.md`](docs/AUTEUR-DASHBOARD-SUIVI.md) — suivi technique détaillé, migrations, comptes de test
- [`docs/README.md`](docs/README.md) — index de la documentation

---

## Contact & crédits

**JSAN 2025** — Société de Nutrition du Bénin (SNB)

- Site : [https://snb-jsan.bj/](https://snb-jsan.bj/)
- E-mail : secretariat@snb-jsan.bj

---

*Journées Scientifiques de l'Alimentation et de la Nutrition — 1ʳᵉ édition, Cotonou, Bénin.*
