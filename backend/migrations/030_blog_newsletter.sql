-- JSAN — Blog public + abonnés newsletter
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unsubscribed')),
  source VARCHAR(40) DEFAULT 'footer',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status
  ON public.newsletter_subscribers (status);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  newsletter_sent_at TIMESTAMPTZ,
  author_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_posts_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON public.blog_posts (status, published_at DESC);

-- Inscription publique via RPC (évite l'exposition directe de la table)
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email TEXT, p_source TEXT DEFAULT 'footer')
RETURNS TABLE (ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := lower(trim(p_email));

  IF normalized = '' OR position('@' in normalized) = 0 THEN
    RETURN QUERY SELECT false, 'Adresse e-mail invalide.'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.newsletter_subscribers (email, status, source, subscribed_at, unsubscribed_at)
  VALUES (normalized, 'active', COALESCE(NULLIF(trim(p_source), ''), 'footer'), NOW(), NULL)
  ON CONFLICT (email) DO UPDATE
    SET status = 'active',
        source = EXCLUDED.source,
        subscribed_at = CASE
          WHEN public.newsletter_subscribers.status = 'unsubscribed' THEN NOW()
          ELSE public.newsletter_subscribers.subscribed_at
        END,
        unsubscribed_at = NULL;

  RETURN QUERY SELECT true, 'Merci ! Vous êtes inscrit à la newsletter JSAN.'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_newsletter(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(TEXT, TEXT) TO anon, authenticated;

-- Étendre les types de campagnes e-mail
ALTER TABLE public.email_campaign_logs
  DROP CONSTRAINT IF EXISTS email_campaign_logs_campaign_kind_check;

ALTER TABLE public.email_campaign_logs
  ADD CONSTRAINT email_campaign_logs_campaign_kind_check
  CHECK (campaign_kind IN ('broadcast', 'test', 'account', 'newsletter', 'blog'));

-- RLS newsletter_subscribers
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "staff_manage_newsletter_subscribers"
  ON public.newsletter_subscribers FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

-- RLS blog_posts
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_blog_posts" ON public.blog_posts;
CREATE POLICY "public_read_published_blog_posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "staff_manage_blog_posts" ON public.blog_posts;
CREATE POLICY "staff_manage_blog_posts"
  ON public.blog_posts FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
