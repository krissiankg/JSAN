# Suivi JSAN Webapp — progression dev

> **Dernière mise à jour :** 29 juin 2026 (pause session)  
> **Statut global :** cœur scientifique + sécurité peer review **terminés** côté code  
> **Prochaine étape recommandée :** ERP **Programme & Sessions**, puis tests manuels RLS (section D) quand tu veux

---

## Point d'arrêt — résumé session (29/06/2026)

Le flux scientifique complet est bouclé (résumés → évaluation → décision orga → manuscrit → décision → retour auteur). Les notifications in-app sont branchées. Le durcissement RLS (migrations 016 + 017) est **écrit et appliqué en base** ; vérifs SQL OK (policies `reviews`). Tests manuels app (checklist section D) **à faire plus tard**.

### Fait dans les sessions récentes

| Tâche | Fichiers / notes |
|-------|------------------|
| Messagerie (refonte UI) | `messagerie/page.tsx`, `MessageEmojiPicker.tsx`, `lib/messages.ts`, seed messages |
| Admin évaluateurs | `admin/evaluateurs/page.tsx`, `lib/evaluators-admin.ts` |
| Résumés / articles à évaluer | `resumes-a-evaluer`, `articles-a-evaluer`, `lib/evaluations.ts` |
| Gestion soumissions (résumés) | `admin/soumissions/page.tsx`, `lib/submissions-admin.ts` |
| Attribution ciblée évaluateurs | `lib/review-assignments.ts` |
| Boucle manuscrits (orga + auteur) | `ManuscriptSubmissionsSection.tsx`, `lib/manuscripts-admin.ts`, onglet Manuscrits dans soumissions, `articles-complets` avec retours |
| Seed évaluations démo | `scripts/seed-evaluations-demo.mjs` → `npm run seed:evaluations` |
| **Notifications in-app** | `lib/notifications.ts` — décision résumé/manuscrit, assignation, justificatif, candidature évaluateur |
| **RLS peer review (016)** | `016_peer_review_rls_hardening.sql` — évaluateur = assignations seulement |
| **Notes confidentielles (017)** | `017_reviews_confidential_column.sql` — colonne `commentaires_admin_secrets` |
| Script vérif post-migration | `backend/scripts/verify-peer-review-rls.sql` |

### Déjà fait avant (sessions antérieures)

| Tâche | Fichiers / notes |
|-------|------------------|
| Justificatifs profil (auteur) | `014`, `lib/profile-documents.ts`, `profil/page.tsx` |
| Validation justificatifs (staff) | `utilisateurs/page.tsx`, `lib/users-admin.ts` |
| Sécurisation routes admin | `EventStaffGuard.tsx`, `admin/layout.tsx` |
| Guides résumés + articles | `010`/`011`/`015`, `parametres`, `nouvelle-soumission`, `nouvel-article` |

### À faire / reprendre plus tard

| Priorité | Sujet |
|----------|--------|
| **1** | ERP **Programme & Sessions** (`admin/programme` — stub 🚧) |
| 2 | Notifications **email** (préférences existent, pas d'envoi) |
| 3 | Tests E2E Playwright + erreurs TS résiduelles |
| 4 | ~~Kkiapay~~ → **remplacé par liens de paiement par produit** (Admin > Paiements). Widget/clés localStorage abandonnés. Webhook auto-confirmation = amélioration future optionnelle |
| 5 | Autres stubs ERP : salles, sponsors, rapports, visioconférences, bibliothèque, paiements, documents |
| — | Tests manuels RLS (section D du script vérif) — **reporté par l'utilisateur** |
| optionnel | Polish UX auteur (topbar recherche, cartes accueil) |

---

## Comptes de test

| Rôle | Email | Mot de passe | Redirection / usage |
|------|-------|--------------|---------------------|
| Auteur | `auteur@jsan-test.com` | `Test@JSAN2025` | `/dashboard/mes-resumes` |
| Évaluateur validé | `evaluateur@jsan-test.com` | `Test@JSAN2025` | Résumés / Articles à évaluer |
| Évaluateur en attente | `evaluateur-attente@jsan-test.com` | `Test@JSAN2025` | Candidature |
| Organisateur | `organisateur@jsan-test.com` | `Test@JSAN2025` | `/dashboard`, Soumissions admin |

Seeds : `npm run seed:users`, `seed:messages`, `seed:evaluations`

---

## Migrations Supabase

**Confirmé appliqué :** 004 → 008, **016**, **017** (vérif SQL policies OK)

**À vérifier / appliquer selon fonctionnalités testées :**

| Fichier | Utilité |
|---------|---------|
| `009_abstract_files_storage.sql` | Pièces jointes résumés |
| `010_documents_config.sql` | `documents_config` (guides) |
| `011_event_documents_storage.sql` | Bucket `event-documents` |
| `012_full_articles.sql` | Articles complets + `article-files` |
| `013_messages_rls.sql` | Messagerie RLS |
| `014_profile_documents.sql` | Justificatifs profil |
| `015_documents_config_articles.sql` | Clé `instructions_article` |
| `016_peer_review_rls_hardening.sql` | ✅ Sécurité assignation évaluateurs |
| `017_reviews_confidential_column.sql` | ✅ Notes confidentielles hors JSON |
| `018_ticket_payment_links.sql` | Liens de paiement Kkiapay par billet (`events_config.ticket_payment_links`) |

Sans **012** → articles cassés. Sans **013** → messagerie. Sans **014** → justificatifs.

**Vérifications après 016+017 :** `backend/scripts/verify-peer-review-rls.sql` (SQL Editor Supabase, requêtes une par une). Section **D** = tests manuels dans l'app.

---

## Flux scientifique (état actuel)

```
Auteur soumet résumé
  → Orga assigne évaluateur (Soumissions)
  → Évaluateur note (Résumés à évaluer)
  → Orga décide résumé ✅
  → Notification auteur ✅

Auteur soumet manuscrit (résumé accepté)
  → Évaluateur note manuscrit (Articles à évaluer)
  → Orga décide manuscrit (Soumissions > Manuscrits) ✅
  → Auteur voit retour (Articles complets) ✅
  → Notification auteur ✅
```

---

## Checklist progression

- [x] Migrations 004 → 008
- [x] Articles complets (012)
- [x] Messagerie (013)
- [x] Justificatifs + validation staff (014)
- [x] Guides organisateur (010/011/015)
- [x] Peer review complet (résumés + manuscrits)
- [x] Gestion soumissions admin + assignation
- [x] Notifications in-app
- [x] RLS durci (016) + notes confidentielles (017)
- [x] Vérif SQL post-migration (policies reviews)
- [ ] Tests manuels RLS (section D — reporté)
- [ ] Programme & Sessions (ERP)
- [ ] Notifications email
- [ ] Tests E2E automatisés
- [ ] Kkiapay webhook production

---

## Fichiers clés (ajouts récents)

```
jsan-webapp/
  app/dashboard/
    admin/soumissions/page.tsx      # Résumés | Manuscrits
    admin/evaluateurs/page.tsx
    resumes-a-evaluer/page.tsx
    articles-a-evaluer/page.tsx
    articles-complets/page.tsx      # retours évaluateurs + décision
    messagerie/page.tsx
  components/dashboard/
    ManuscriptSubmissionsSection.tsx
    NotificationBell.tsx
  lib/
    submissions-admin.ts
    manuscripts-admin.ts
    review-assignments.ts
    evaluations.ts
    notifications.ts
    messages.ts

backend/migrations/
  016_peer_review_rls_hardening.sql
  017_reviews_confidential_column.sql

backend/scripts/
  verify-peer-review-rls.sql
```

---

## Parcours de test suggéré (reprise)

### Scientifique + notifications
1. `npm run seed:evaluations`
2. **Organisateur** : Soumissions → assigner évaluateur → décider résumé
3. **Évaluateur** : Résumés à évaluer → noter
4. **Auteur** : cloche 🔔 + Mes résumés
5. **Auteur** : Nouvel article → soumettre manuscrit
6. **Évaluateur** : Articles à évaluer → noter (+ note confidentielle)
7. **Organisateur** : Soumissions > Manuscrits → décider
8. **Auteur** : Articles complets → déplier retours

### RLS (quand tu voudras — section D)
1. Évaluateur : uniquement résumés/manuscrits **assignés**
2. Auteur : pas de `commentaires_admin_secrets` visible
3. Organisateur : notes confidentielles visibles dans Soumissions
4. Téléchargement manuscrit assigné (évaluateur)

---

## Phrase de reprise

> « Reprenons JSAN : voir `docs/AUTEUR-DASHBOARD-SUIVI.md` — flux scientifique + RLS 016/017 terminés, vérif SQL OK. Prochaine étape : **Programme & Sessions** (ERP). Tests manuels RLS reportés. »
