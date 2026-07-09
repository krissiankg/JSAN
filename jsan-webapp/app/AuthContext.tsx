"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  type AppUserRole,
  type DbUserRole,
  type RegisterRole,
  type UserProfile,
  mapDbRoleToAppRole,
  isEvaluatorApproved,
  registerRoleToDbRole,
} from '@/lib/roles';

export type UserRole = AppUserRole | null;

interface SignUpData {
  email: string;
  password: string;
  role: RegisterRole;
  nom: string;
  prenom: string;
  institution?: string;
  specialite?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  profile: UserProfile | null;
  userRole: UserRole;
  dbRole: DbUserRole | null;
  isStudentVerified: boolean;
  isMemberVerified: boolean;
  isEvaluatorApproved: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (data: SignUpData) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setStudentVerified: (status: boolean) => void;
  setMemberVerified: (status: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const dbRole = profile?.role ?? null;
  const userRole: UserRole = dbRole ? mapDbRoleToAppRole(dbRole) : null;
  const isLoggedIn = !!user;
  const isStudentVerified = profile?.is_student_verified ?? false;
  const isMemberVerified = profile?.is_member_verified ?? false;
  const evaluatorApproved = dbRole ? isEvaluatorApproved(dbRole) : false;

  useEffect(() => {
    if (!user || !profile || profile.welcome_email_sent_at) return;
    void fetch('/api/notify/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        templateKey: 'account_welcome',
        link: '/dashboard',
        variables: {
          role_label:
            dbRole === 'pair_en_attente'
              ? 'Évaluateur (en attente)'
              : dbRole === 'pair_valide'
                ? 'Évaluateur'
                : dbRole === 'auteur'
                  ? 'Auteur'
                  : dbRole === 'organisateur'
                    ? 'Organisateur'
                    : dbRole === 'superadmin' || dbRole === 'admin'
                      ? 'Super Admin'
                      : 'Participant',
        },
      }),
    }).catch(() => {
      /* e-mail secondaire */
    });
  }, [user, profile, dbRole]);

  const refreshProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setUser(null);
      setProfile(null);
      return;
    }
    setUser(currentUser);
    const userProfile = await fetchProfile(supabase, currentUser.id);
    setProfile(userProfile);
  }, [supabase]);

  useEffect(() => {
    refreshProfile().finally(() => {
      setIsLoading(false);
      setMounted(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const userProfile = await fetchProfile(supabase, session.user.id);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, refreshProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await refreshProfile();
    return {};
  };

  const signUp = async (data: SignUpData) => {
    const { email, password, role, nom, prenom, institution, specialite } = data;

    const registrationsRes = await fetch('/api/registrations/status', { cache: 'no-store' });
    if (registrationsRes.ok) {
      const registrations = (await registrationsRes.json()) as { open?: boolean };
      if (!registrations.open) {
        return { error: 'Les inscriptions sont actuellement closes sur la plateforme.' };
      }
    } else {
      return { error: 'Impossible de vérifier le statut des inscriptions. Réessayez dans quelques instants.' };
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: registerRoleToDbRole(role),
          nom,
          prenom,
          institution: institution ?? null,
          specialite: specialite ?? null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) return { error: error.message };

    const needsEmailConfirmation = !signUpData.session;

    if (signUpData.session && signUpData.user) {
      await refreshProfile();
    }

    if (signUpData.user?.id) {
      const roleLabel = role === 'participant' ? 'Participant' : role === 'auteur' ? 'Auteur' : 'Évaluateur';
      const accountTemplate = needsEmailConfirmation ? 'account_email_confirmation' : 'account_registration';
      void fetch('/api/notify/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: signUpData.user.id,
          recipientEmail: email,
          templateKey: accountTemplate,
          link: needsEmailConfirmation ? '/login' : '/dashboard',
          variables: {
            prenom,
            nom_complet: `${prenom} ${nom}`.trim(),
            email,
            role_label: roleLabel,
          },
        }),
      }).catch(() => {
        /* e-mail secondaire */
      });
    }

    return { needsEmailConfirmation };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const setStudentVerified = (status: boolean) => {
    setProfile((prev) => prev ? { ...prev, is_student_verified: status } : prev);
  };

  const setMemberVerified = (status: boolean) => {
    setProfile((prev) => prev ? { ...prev, is_member_verified: status } : prev);
  };

  if (!mounted) {
    return (
      <AuthContext.Provider
        value={{
          isLoggedIn: false,
          isLoading: true,
          user: null,
          profile: null,
          userRole: null,
          dbRole: null,
          isStudentVerified: false,
          isMemberVerified: false,
          isEvaluatorApproved: false,
          signIn,
          signUp,
          signOut,
          refreshProfile,
          setStudentVerified,
          setMemberVerified,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        user,
        profile,
        userRole,
        dbRole,
        isStudentVerified,
        isMemberVerified,
        isEvaluatorApproved: evaluatorApproved,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        setStudentVerified,
        setMemberVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Rétrocompatibilité temporaire — à retirer progressivement
export type { AppUserRole };
