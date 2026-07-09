-- JSAN 2025 — Vérifications peer review (RLS + notes confidentielles)
-- À exécuter APRÈS les migrations 016 et 017, connecté en SQL Editor
-- (ou via psql avec un rôle service_role pour les checks structurels).
--
-- Pourquoi après 016 + 017 ?
--   016 restreint l'accès aux soumissions assignées.
--   017 déplace les notes confidentielles hors du JSON scores.
--   Tester avant = faux positifs / faux négatifs.

-- ===========================================================================
-- A. Structure & données (017)
-- ===========================================================================

-- A1. Colonne présente
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reviews'
  AND column_name = 'commentaires_admin_secrets';

-- A2. Plus de notes confidentielles dans scores (attendu : 0 ligne)
SELECT id, abstract_id, scores
FROM public.reviews
WHERE scores IS NOT NULL
  AND scores ? 'commentaires_confidentiels';

-- A3. Trigger actif
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.reviews'::regclass
  AND tgname = 'reviews_normalize_confidential';

-- ===========================================================================
-- B. Fonctions helper (016)
-- ===========================================================================

SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_assigned_reviewer',
    'is_assigned_reviewer_for_article',
    'reviewer_can_read_abstract_file',
    'reviewer_can_read_article_file'
  )
ORDER BY proname;

-- ===========================================================================
-- C. Policies reviews (016) — noms attendus
-- ===========================================================================

SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.reviews'::regclass
ORDER BY polname;

-- Attendu (SELECT/INSERT/UPDATE selon policy) :
--   authors_read_own_reviews
--   reviewers_read_own_reviews
--   reviewers_insert_own_reviews
--   reviewers_update_own_reviews
--   staff_manage_all_reviews
-- (reviewers_manage_reviews ne doit PLUS exister)

SELECT polname
FROM pg_policy
WHERE polrelid = 'public.reviews'::regclass
  AND polname = 'reviewers_manage_reviews';
-- → 0 ligne

-- ===========================================================================
-- D. Tests manuels applicatifs (à faire dans l'app après seed)
-- ===========================================================================
--
-- 1. evaluateur@jsan-test.com — ne voit QUE les résumés/manuscrits assignés
-- 2. Même compte — ne peut PAS lire les reviews d'un autre évaluateur (API directe)
-- 3. auteur@jsan-test.com — mes-resumes : pas de commentaires_admin_secrets exposés
-- 4. organisateur@jsan-test.com — soumissions : voit les notes confidentielles staff
-- 5. Téléchargement manuscrit assigné (signed URL article-files) OK pour évaluateur
--
-- Comptes seed : npm run seed:evaluations (mot de passe Test@JSAN2025)
