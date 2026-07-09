-- JSAN 2025 - Migration 027
-- Historique des campagnes e-mail et tests.

CREATE TABLE IF NOT EXISTS public.email_campaign_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  campaign_kind VARCHAR(20) NOT NULL DEFAULT 'broadcast'
    CHECK (campaign_kind IN ('broadcast', 'test', 'account')),
  template_key VARCHAR(80) NOT NULL,
  audience_label VARCHAR(120),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_created_at
  ON public.email_campaign_logs (created_at DESC);

ALTER TABLE public.email_campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_email_campaign_logs" ON public.email_campaign_logs;
CREATE POLICY "staff_manage_email_campaign_logs"
  ON public.email_campaign_logs FOR ALL
  TO authenticated
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());
