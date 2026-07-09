-- JSAN 2025 - Migration 013
-- RLS messagerie interne

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_messages" ON public.messages;
CREATE POLICY "users_read_own_messages"
  ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
CREATE POLICY "users_send_messages"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "users_mark_received_read" ON public.messages;
CREATE POLICY "users_mark_received_read"
  ON public.messages FOR UPDATE
  USING (receiver_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_all_messages" ON public.messages;
CREATE POLICY "staff_read_all_messages"
  ON public.messages FOR SELECT
  USING (public.is_event_staff());

DROP POLICY IF EXISTS "staff_send_messages" ON public.messages;
CREATE POLICY "staff_send_messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_event_staff() AND sender_id = auth.uid());
