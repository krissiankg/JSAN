-- JSAN 2025 - Migration 017
-- Notes confidentielles : colonne dédiée commentaires_admin_secrets
-- (au lieu de scores->>'commentaires_confidentiels' dans le JSONB).
--
-- À exécuter après 016_peer_review_rls_hardening.sql.
-- Les vérifications manuelles / script verify-peer-review-rls.sql
-- se font APRÈS application de 016 + 017 (sinon les tests sont incomplets).

-- ---------------------------------------------------------------------------
-- 1. Colonne (déjà dans schema.sql ; sécurise les BDD plus anciennes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS commentaires_admin_secrets TEXT;

-- ---------------------------------------------------------------------------
-- 2. Rétro-migration des données existantes
-- ---------------------------------------------------------------------------

UPDATE public.reviews
SET commentaires_admin_secrets = NULLIF(TRIM(scores->>'commentaires_confidentiels'), '')
WHERE commentaires_admin_secrets IS NULL
  AND scores IS NOT NULL
  AND scores ? 'commentaires_confidentiels'
  AND NULLIF(TRIM(scores->>'commentaires_confidentiels'), '') IS NOT NULL;

UPDATE public.reviews
SET scores = scores - 'commentaires_confidentiels'
WHERE scores IS NOT NULL
  AND scores ? 'commentaires_confidentiels';

-- ---------------------------------------------------------------------------
-- 3. Trigger : empêche la réintroduction dans scores à l'avenir
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reviews_normalize_confidential_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scores IS NOT NULL AND NEW.scores ? 'commentaires_confidentiels' THEN
    NEW.commentaires_admin_secrets := COALESCE(
      NULLIF(TRIM(NEW.commentaires_admin_secrets), ''),
      NULLIF(TRIM(NEW.scores->>'commentaires_confidentiels'), '')
    );
    NEW.scores := NEW.scores - 'commentaires_confidentiels';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_normalize_confidential ON public.reviews;
CREATE TRIGGER reviews_normalize_confidential
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_normalize_confidential_notes();
