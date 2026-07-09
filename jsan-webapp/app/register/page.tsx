"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'participant' | 'auteur' | 'pair'>('participant');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Set initial role from query params if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preRole = params.get('role');
    if (preRole === 'pair') setRole('pair');
    else if (preRole === 'auteur') setRole('auteur');
    else if (preRole === 'participant') setRole('participant');
  }, []);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setAlert(null);

    const formData = new FormData(e.currentTarget);
    const pwd = formData.get(`${role}-password`) as string;
    const confirmPwd = formData.get(`${role}-password-confirm`) as string;
    const email = formData.get(`${role}-email`) as string;
    const nom = formData.get(`${role}-nom`) as string;
    const prenom = formData.get(`${role}-prenom`) as string;
    const institution = formData.get('auteur-institution') as string | null;
    const specialite = formData.get('pair-specialite') as string | null;

    if (pwd !== confirmPwd) {
      setIsLoading(false);
      setAlert({ type: 'error', message: '⚠ Les mots de passe ne correspondent pas.' });
      return;
    }

    const { error, needsEmailConfirmation } = await signUp({
      email,
      password: pwd,
      role,
      nom,
      prenom,
      institution: institution ?? undefined,
      specialite: specialite ?? undefined,
    });

    setIsLoading(false);

    if (error) {
      setAlert({ type: 'error', message: `⚠ ${error}` });
      return;
    }

    if (needsEmailConfirmation) {
      setAlert({
        type: 'success',
        message: '✓ Compte créé ! Vérifiez votre e-mail pour confirmer votre inscription, puis connectez-vous.',
      });
      setTimeout(() => router.push(`/login?role=${role}`), 3000);
      return;
    }

    if (role === 'participant') {
      setAlert({ type: 'success', message: '✓ Compte Participant créé ! Redirection vers la connexion...' });
      setTimeout(() => router.push('/login?role=participant'), 2000);
    } else if (role === 'auteur') {
      setAlert({ type: 'success', message: '✓ Compte Auteur créé ! Redirection vers la connexion...' });
      setTimeout(() => router.push('/login?role=auteur'), 2000);
    } else {
      setAlert({
        type: 'success',
        message: "✓ Candidature envoyée ! En attendant la validation, connectez-vous avec votre compte.",
      });
      setTimeout(() => router.push('/login?role=pair'), 3000);
    }
  };

  const roleConfig = {
    participant: {
      title: 'Inscription Participant',
      subtitle: 'Créez votre compte pour acheter des billets et assister à l\'événement'
    },
    auteur: {
      title: 'Inscription Auteur',
      subtitle: 'Créez votre compte pour soumettre un résumé'
    },
    pair: {
      title: 'Devenir Évaluateur',
      subtitle: 'Postulez pour intégrer le comité de lecture'
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
            <span>🌍</span> Rejoignez le réseau
          </div>
          <h1>Créer un<br /><span>Nouveau</span><br />Compte</h1>
          <p>Inscrivez-vous pour soumettre vos travaux scientifiques ou pour rejoindre notre prestigieux comité de relecture.</p>
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
          <div className="role-tabs" role="tablist" aria-label="Sélecteur de type de compte">
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
              <span className="tab-label">Compte Auteur</span>
            </button>
            <button 
              className={`role-tab ${role === 'pair' ? 'active' : ''}`} 
              onClick={() => { setRole('pair'); setAlert(null); }}
              role="tab" 
              aria-selected={role === 'pair'}
            >
              <span className="tab-icon">🔍</span>
              <span className="tab-label">Devenir Évaluateur</span>
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

            {/* ===== FORM ===== */}
            <div className="role-form-panel active" style={{ animation: 'none' }}>
              <form onSubmit={handleRegister} autoComplete="off">
                
                {role === 'pair' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="pair-titre">Titre</label>
                      <select id="pair-titre" name="pair-titre" className="form-input" required defaultValue="">
                        <option value="" disabled>Sélectionner</option>
                        <option value="Pr">Pr</option>
                        <option value="Dr">Dr</option>
                        <option value="Mr">Mr</option>
                        <option value="Mme">Mme</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`${role}-prenom`}>Prénom</label>
                    <input type="text" id={`${role}-prenom`} name={`${role}-prenom`} className="form-input" placeholder="Ex: Jean" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`${role}-nom`}>Nom</label>
                    <input type="text" id={`${role}-nom`} name={`${role}-nom`} className="form-input" placeholder="Ex: Dupont" required />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor={`${role}-email`}>Adresse e-mail {role === 'pair' ? 'institutionnelle' : role === 'auteur' ? 'professionnelle' : ''}</label>
                  <div className="input-wrapper">
                    <span className="input-icon">✉</span>
                    <input type="email" id={`${role}-email`} name={`${role}-email`} className="form-input" placeholder={role === 'pair' ? 'nom@institution.org' : 'nom@exemple.com'} required />
                  </div>
                </div>

                {role === 'auteur' && (
                  <div className="form-group">
                    <label htmlFor="auteur-institution">Institution / Université</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🏫</span>
                      <input type="text" id="auteur-institution" name="auteur-institution" className="form-input" placeholder="Nom de l'organisation" required />
                    </div>
                  </div>
                )}
                {role === 'pair' && (
                  <div className="form-group">
                    <label htmlFor="pair-specialite">Spécialité / Domaine d'expertise</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔬</span>
                      <input type="text" id="pair-specialite" name="pair-specialite" className="form-input" placeholder="Ex: Nutrition clinique, Sécurité sanitaire..." required />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`${role}-password`}>Mot de passe</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        id={`${role}-password`} 
                        name={`${role}-password`}
                        className="form-input" 
                        placeholder="8+ caractères" 
                        required 
                        pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}" 
                        title="Doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre"
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor={`${role}-password-confirm`}>Confirmer</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input 
                        type={showPasswordConfirm ? 'text' : 'password'} 
                        id={`${role}-password-confirm`} 
                        name={`${role}-password-confirm`}
                        className="form-input" 
                        placeholder="Répéter" 
                        required 
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}>
                        {showPasswordConfirm ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-options">
                  <label className="remember-me">
                    <input type="checkbox" id={`${role}-terms`} name={`${role}-terms`} required />
                    {role === 'pair' ? " Je certifie l'exactitude des informations fournies." : " J'accepte les conditions générales d'utilisation."}
                  </label>
                </div>

                <button type="submit" className={`login-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
                  {isLoading ? (
                    <span className="spinner" style={{ display: 'inline-block' }}></span>
                  ) : (
                    <>
                      <span className="btn-text">
                        {role === 'participant' ? 'Créer mon compte' : role === 'auteur' ? 'Créer mon compte Auteur' : 'Soumettre ma candidature'}
                      </span>
                      <span className="btn-arrow">→</span>
                    </>
                  )}
                </button>
              </form>

              <div className="form-divider"><span>ou</span></div>

              <p className="register-prompt">
                {role === 'participant' ? (
                  <>Déjà inscrit ? <Link href="/login?role=participant">Se connecter</Link></>
                ) : role === 'auteur' ? (
                  <>Déjà inscrit ? <Link href="/login?role=auteur">Se connecter</Link></>
                ) : (
                  <>Déjà évaluateur ? <Link href="/login?role=pair">Se connecter</Link></>
                )}
              </p>
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
