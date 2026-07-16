-- JSAN — Catalogue des billets (CRUD admin)
-- Table ticket_types + bucket storage pour les photos.
-- Les ids texte restent compatibles avec events_config.ticket_payment_links.
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.ticket_types (
  id TEXT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  category VARCHAR(80) NOT NULL DEFAULT 'Général',
  image_path TEXT,
  image_url TEXT,
  requires_student BOOLEAN NOT NULL DEFAULT false,
  requires_member BOOLEAN NOT NULL DEFAULT false,
  ordre INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_active_order
  ON public.ticket_types (is_active, ordre, title);

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_ticket_types" ON public.ticket_types;
CREATE POLICY "public_read_ticket_types"
  ON public.ticket_types FOR SELECT
  USING (is_active = true OR public.is_event_staff());

DROP POLICY IF EXISTS "staff_manage_ticket_types" ON public.ticket_types;
CREATE POLICY "staff_manage_ticket_types"
  ON public.ticket_types FOR ALL
  USING (public.is_event_staff())
  WITH CHECK (public.is_event_staff());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-images',
  'ticket-images',
  true,
  5242880, -- 5 Mo
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_ticket_images" ON storage.objects;
CREATE POLICY "public_read_ticket_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ticket-images');

DROP POLICY IF EXISTS "staff_manage_ticket_images" ON storage.objects;
CREATE POLICY "staff_manage_ticket_images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'ticket-images' AND public.is_event_staff())
  WITH CHECK (bucket_id = 'ticket-images' AND public.is_event_staff());

-- Seed initial (ids inchangés pour les liens Kkiapay existants)
INSERT INTO public.ticket_types (
  id, title, description, amount, category, image_url,
  requires_student, requires_member, ordre, is_active
) VALUES
  (
    'membre-snb-etudiant',
    'Membre SNB - Étudiant',
    'Accès étudiant pour les membres actifs de la SNB.',
    10000,
    'Membre SNB',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=400',
    true, true, 10, true
  ),
  (
    'membre-snb-pro',
    'Membre SNB - Professionnel',
    'Accès professionnel pour les membres actifs.',
    35000,
    'Membre SNB',
    'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&q=80&w=400',
    false, true, 20, true
  ),
  (
    'non-membre-etudiant',
    'Non-membre SNB - Étudiant',
    'Accès étudiant pour les non-membres.',
    10000,
    'Non-membre SNB',
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=400',
    true, false, 30, true
  ),
  (
    'non-membre-pro',
    'Non-membre SNB - Professionnel',
    'Accès chercheur / professionnel pour les non-membres.',
    40000,
    'Non-membre SNB',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
    false, false, 40, true
  ),
  (
    'formation-pre-congres',
    'Formation Pré-Congrès',
    'Accès aux formations spécifiques du congrès.',
    15000,
    'Formation',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=400',
    false, false, 50, true
  ),
  (
    'stand-expo-etudiant',
    'Stand Expo - Étudiant',
    'Espace d''exposition réservé aux projets étudiants.',
    50000,
    'Exposition',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&q=80&w=400',
    true, false, 60, true
  ),
  (
    'stand-expo-entreprise',
    'Stand Expo - Entreprise',
    'Espace d''exposition premium pour les entreprises.',
    75000,
    'Exposition',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400',
    false, false, 70, true
  ),
  (
    'symposium',
    'Ticket Symposium',
    'Accès exclusif au Symposium (Partenariat/Sponsoring).',
    2000000,
    'Symposium',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=400',
    false, false, 80, true
  )
ON CONFLICT (id) DO NOTHING;
