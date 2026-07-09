-- JSAN 2025 - Supabase Schema (Updated with Dynamic Config & Complex Relationships)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Configuration Globale (Dynamic settings defined by Admin)
CREATE TABLE public.events_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom_evenement VARCHAR(255) NOT NULL,
    double_aveugle_actif BOOLEAN DEFAULT true,
    themes_disponibles JSONB, -- e.g., ["Nutrition", "Santé Publique", "Pédiatrie"]
    types_presentation JSONB, -- e.g., ["Oral", "Poster", "Symposium"]
    upload_rules JSONB,       -- e.g., {"max_files": 3, "max_size_mb": 10, "allowed_extensions": ["pdf", "jpg", "png"]}
    date_debut DATE,
    date_fin DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Utilisateurs (Extension de Supabase Auth)
CREATE TYPE user_role AS ENUM (
    'participant',
    'auteur',
    'pair_en_attente',
    'pair_valide',
    'organisateur',
    'superadmin',
    'admin'
);

CREATE TABLE public.users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'auteur',
    nom VARCHAR(100),
    prenom VARCHAR(100),
    institution VARCHAR(255),
    telephone VARCHAR(50),
    specialite TEXT,
    is_student_verified BOOLEAN DEFAULT false,
    is_member_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Résumés / Abstracts
CREATE TYPE abstract_status AS ENUM ('Brouillon', 'Soumis', 'En_Evaluation', 'Accepte', 'Rejete', 'A_Reviser');

CREATE TABLE public.abstracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES public.users_profile(id) ON DELETE CASCADE, -- User submitting
    titre VARCHAR(500) NOT NULL,
    contenu_texte TEXT,
    mots_cles TEXT, -- Keywords separated by commas
    thematique TEXT, -- Chosen from events_config.themes_disponibles
    type_presentation_global TEXT, -- Chosen from events_config.types_presentation
    statut abstract_status DEFAULT 'Brouillon',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.1 Auteurs, Co-auteurs et Orateurs du résumé
CREATE TABLE public.abstract_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abstract_id UUID REFERENCES public.abstracts(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    affiliation TEXT NOT NULL,
    est_orateur BOOLEAN DEFAULT false,
    type_presentation_orateur TEXT, -- e.g., Oral, if speaker specific type differs or just for tracking
    ordre_affichage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Fichiers Joints au résumé (Multiple uploads)
CREATE TABLE public.abstract_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abstract_id UUID REFERENCES public.abstracts(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- pdf, jpg, docx
    file_size_mb DECIMAL(10,2),
    type_document VARCHAR(100), -- e.g., 'Resume_Principal', 'Poster_Annexe', 'Figures'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Évaluations / Reviews
CREATE TYPE review_status AS ENUM ('En_Attente', 'Complete');

CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abstract_id UUID REFERENCES public.abstracts(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.users_profile(id) ON DELETE CASCADE,
    scores JSONB, -- Stockage flexible pour la grille de notation
    commentaires_auteurs TEXT,
    commentaires_admin_secrets TEXT,
    statut review_status DEFAULT 'En_Attente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Messagerie Interne (Chat)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.users_profile(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL, -- Null si c'est un message général/groupe
    abstract_id UUID REFERENCES public.abstracts(id) ON DELETE CASCADE, -- Lier la discussion à un résumé (optionnel)
    contenu TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Programme et Sessions Multi-salles
CREATE TABLE public.agenda_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    date_session DATE,
    heure_debut TIME,
    heure_fin TIME,
    salle_nom VARCHAR(100), -- Ex: "Salle Virtuelle A"
    lien_live_zoom TEXT, -- URL générée via l'API Zoom
    abstracts_inclus UUID[], -- Liste des résumés présentés
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Billetterie (KKiaPay)
CREATE TYPE payment_status AS ENUM ('En_Attente', 'Paye', 'Echoue');

CREATE TABLE public.tickets_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users_profile(id) ON DELETE CASCADE,
    type_billet VARCHAR(100) NOT NULL,
    transaction_id_kkiapay VARCHAR(255) UNIQUE,
    montant DECIMAL(10,2),
    statut_paiement payment_status DEFAULT 'En_Attente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: RLS (Row Level Security) policies to be added separately.
