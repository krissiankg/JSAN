"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { getDashboardHomePath, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import { useRegistrationsOpen } from '@/hooks/use-registrations-open';

export default function LoginPage() {
  const { signIn, refreshProfile } = useAuth();
  const registrationsOpen = useRegistrationsOpen();
  const router = useRouter();
  const [role, setRole] = useState<'participant' | 'auteur' | 'pair'>('participant');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preRole = params.get('role');
    if (preRole === 'pair') setRole('pair');
    else if (preRole === 'auteur') setRole('auteur');
    else if (preRole === 'participant') setRole('participant');

    if (params.get('error') === 'auth_callback_failed') {
      setAlert({ type: 'error', message: 'La confirmation du compte a échoué. Réessayez de vous connecter.' });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setAlert(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get(`${role}-email`) as string;
    const password = formData.get(`${role}-password`) as string;

    const { error } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      setAlert({ type: 'error', message: `⚠ ${error}` });
      return;
    }

    await refreshProfile();

    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      setAlert({ type: 'error', message: '⚠ Session introuvable après connexion.' });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setIsLoading(false);
      setAlert({
        type: 'error',
        message: '⚠ Connexion OK mais profil introuvable. Exécutez la migration 003 dans Supabase ou contactez l\'admin.',
      });
      return;
    }

    const dbRole = profile.role as DbUserRole;
    const appRole = mapDbRoleToAppRole(dbRole);
    const redirectPath = getDashboardHomePath(appRole, dbRole);

    setAlert({ type: 'success', message: '✓ Connexion réussie ! Redirection en cours...' });
    setTimeout(() => router.push(redirectPath), 800);
    setIsLoading(false);
  };

  const roleConfig = {
    participant: {
      title: 'Espace Participant',
      subtitle: 'Connectez-vous pour acheter vos billets et accéder à l\'événement'
    },
    auteur: {
      title: 'Connectez-vous',
      subtitle: 'Accédez à votre espace de soumission de résumés'
    },
    pair: {
      title: 'Espace Évaluateur',
      subtitle: 'Accédez aux résumés qui vous sont assignés'
    }
  };

  return (
    <div className="login-wrapper">
      {/* ===== LEFT: Image Panel ===== */}
      <div className="login-image-panel">
        <img src="/media/media_library/9P6A0331.jpg" alt="Participants JSAN 2025 au Palais des Congrès, Cotonou" />
        <div className="login-image-overlay"></div>

        {/* Decorative floating circles */}
        <div className="deco-circle c1"></div>
        <div className="deco-circle c2"></div>

        <div className="login-image-content">
          <div className="event-badge">
            <span>🔬</span> JSAN 2025 — 1ʳᵉ Édition
          </div>
          <h1>Plateforme de<br />Soumission <span>&</span><br />Évaluation</h1>
          <p>Soumettez vos résumés scientifiques et participez au processus d'évaluation par les pairs pour les Journées Scientifiques de l'Alimentation et de la Nutrition.</p>
        </div>
      </div>

      {/* ===== RIGHT: Form Panel ===== */}
      <div className="login-form-panel">
        <div className="login-form-container">

          {/* Logo */}
          <div className="login-logo">
            <img src="/media/media_library/logo-jsan.png" alt="Logo JSAN" />
          </div>

          {/* Header */}
          <div className="login-header">
            <h2 id="login-title">{roleConfig[role].title}</h2>
            <p id="login-subtitle">{roleConfig[role].subtitle}</p>
          </div>

          {/* Role Tabs */}
          <div className="role-tabs" role="tablist" aria-label="Sélecteur de rôle">
            <button 
              className={`role-tab ${role === 'participant' ? 'active' : ''}`} 
              onClick={() => { setRole('participant'); setAlert(null); }}
              role="tab" 
              aria-selected={role === 'participant'}
            >
              <span className="tab-icon">🎟️</span>
              <span className="tab-label">Participant</span>
            </button>
            <button 
              className={`role-tab ${role === 'auteur' ? 'active' : ''}`} 
              onClick={() => { setRole('auteur'); setAlert(null); }}
              role="tab" 
              aria-selected={role === 'auteur'}
            >
              <span className="tab-icon">📝</span>
              <span className="tab-label">Auteur</span>
            </button>
            <button 
              className={`role-tab ${role === 'pair' ? 'active' : ''}`} 
              onClick={() => { setRole('pair'); setAlert(null); }}
              role="tab" 
              aria-selected={role === 'pair'}
            >
              <span className="tab-icon">🔍</span>
              <span className="tab-label">Évaluateur</span>
            </button>
          </div>

          {/* ===== LOGIN CARD ===== */}
          <div className="login-card" id="login-card">

            {/* Alert placeholder */}
            {alert && (
              <div className={`login-alert ${alert.type}`} role="alert" style={{ display: 'flex' }}>
                <span className="alert-icon">{alert.type === 'error' ? '⚠' : '✓'}</span>
                <span className="alert-text">{alert.message}</span>
              </div>
            )}

            {/* ===== AUTEUR / PAIR Form ===== */}
            <div className="role-form-panel active" style={{ animation: 'none' }}>
              <form onSubmit={handleLogin} autoComplete="on">
                <div className="form-group">
                  <label htmlFor={`${role}-email`}>Adresse e-mail {role === 'pair' ? 'institutionnelle' : ''}</label>
                  <div className="input-wrapper">
                    <span className="input-icon">✉</span>
                    <input 
                      type="email" 
                      id={`${role}-email`}
                      name={`${role}-email`}
                      className="form-input" 
                      placeholder={role === 'pair' ? 'pair@institution.org' : 'nom@exemple.com'} 
                      autoComplete="email" 
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor={`${role}-password`}>Mot de passe</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      id={`${role}-password`}
                      name={`${role}-password`}
                      className="form-input" 
                      placeholder="••••••••" 
                      autoComplete="current-password" 
                      required 
                      minLength={6} 
                    />
                    <button 
                      type="button" 
                      className="password-toggle" 
                      onClick={() => setShowPassword(!showPassword)} 
                      aria-label="Afficher le mot de passe"
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div className="form-options">
                  <label className="remember-me">
                    <input type="checkbox" id={`${role}-remember`} />
                    Se souvenir de moi
                  </label>
                  <Link href="#" className="forgot-link">Mot de passe oublié ?</Link>
                </div>

                <button type="submit" className={`login-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
                  {isLoading ? (
                    <span className="spinner" style={{ display: 'inline-block' }}></span>
                  ) : (
                    <>
                      <span className="btn-text">{role === 'pair' ? "Accéder à l'espace Évaluateur" : "Se connecter"}</span>
                      <span className="btn-arrow">→</span>
                    </>
                  )}
                </button>
              </form>

              {registrationsOpen !== false && (
                <>
                  <div className="form-divider"><span>ou</span></div>
                  <p className="register-prompt">
                    {role === 'participant' ? (
                      <>Pas encore de compte ? <Link href="/register?role=participant">Créer un compte Participant</Link></>
                    ) : role === 'auteur' ? (
                      <>Pas encore de compte ? <Link href="/register?role=auteur">Créer un compte Auteur</Link></>
                    ) : (
                      <>Nouveau pair-évaluateur ? <Link href="/register?role=pair">Demander un accès</Link></>
                    )}
                  </p>
                </>
              )}
            </div>

          </div>{/* /login-card */}

          {/* Back link */}
          <Link href="/" className="back-to-site">
            <span>←</span> Retour au site JSAN
          </Link>

        </div>{/* /login-form-container */}
      </div>{/* /login-form-panel */}
    </div>
  );
}
