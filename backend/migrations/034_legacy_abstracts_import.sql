-- JSAN 2025 - Migration 034
-- Import des résumés de la 11ᵉ édition (WordPress) + revendication par e-mail.
--
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE public.abstracts
  ADD COLUMN IF NOT EXISTS legacy_id INTEGER,
  ADD COLUMN IF NOT EXISTS claim_email TEXT,
  ADD COLUMN IF NOT EXISTS edition VARCHAR(50),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS library_document_id UUID REFERENCES public.library_documents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_abstracts_legacy_id_unique
  ON public.abstracts (legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abstracts_claim_email_pending
  ON public.abstracts (lower(claim_email))
  WHERE author_id IS NULL AND claim_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abstracts_edition
  ON public.abstracts (edition);

COMMENT ON COLUMN public.abstracts.legacy_id IS 'ID résumé WordPress (JSAN édition précédente)';
COMMENT ON COLUMN public.abstracts.claim_email IS 'E-mail auteur legacy pour rattachement automatique au compte';
COMMENT ON COLUMN public.abstracts.edition IS 'Ex. JSAN 2025 — distingue les imports des nouvelles soumissions';

-- Les résumés non revendiqués (author_id NULL) restent lisibles par le staff uniquement
-- (politiques existantes). Après claim, l''auteur les voit via author_id = auth.uid().

ALTER TABLE public.library_documents
  ADD COLUMN IF NOT EXISTS legacy_abstract_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_documents_legacy_abstract
  ON public.library_documents (legacy_abstract_id)
  WHERE legacy_abstract_id IS NOT NULL;
