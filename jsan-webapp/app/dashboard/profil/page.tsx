"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getRoleLabel, DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/roles';
import {
  type ProfileDocument,
  fetchProfileDocuments,
  uploadProfileDocument,
  deleteProfileDocument,
  getProfileDocumentSignedUrl,
  profileDocStatusLabel,
  profileDocBadgeClass,
  formatProfileDocDate,
} from '@/lib/profile-documents';
import { countries } from '../../utils/countries';
import '../../styles/profile.css';

type ProfileTab = 'informations' | 'justificatifs' | 'securite' | 'notifications';

export default function ProfilPage() {
  const {
    user, profile, userRole, isLoading,
    isStudentVerified, isMemberVerified,
    refreshProfile,
  } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ProfileTab>('informations');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<'etudiant' | 'membre' | null>(null);

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'preferences' || hash === 'notifications') {
        setActiveTab('notifications');
      } else if (hash === 'justificatifs' || hash === 'securite' || hash === 'informations') {
        setActiveTab(hash);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [institution, setInstitution] = useState('');
  const [specialite, setSpecialite] = useState('');
  const [bio, setBio] = useState('');
  const [pays, setPays] = useState('Bénin');
  const [countryCode, setCountryCode] = useState('+229');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [studentDoc, setStudentDoc] = useState<ProfileDocument | null>(null);
  const [memberDoc, setMemberDoc] = useState<ProfileDocument | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState<'etudiant' | 'membre' | null>(null);
  const [docsMessage, setDocsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
  const showSubmissionNotifications = userRole === 'auteur' || userRole === 'pair' || userRole === 'organisateur' || userRole === 'superadmin';
  const BIO_MAX_LENGTH = 500;

  useEffect(() => {
    if (!profile) return;
    setPrenom(profile.prenom ?? '');
    setNom(profile.nom ?? '');
    setInstitution(profile.institution ?? '');
    setSpecialite(profile.specialite ?? '');
    setBio(profile.bio ?? '');
    setPays(profile.pays?.trim() || 'Bénin');
    if (profile.telephone) {
      const match = countries.find((c) => profile.telephone?.startsWith(c.code));
      if (match) {
        setCountryCode(match.code);
        setTelephone(profile.telephone.slice(match.code.length).trim());
      } else {
        setTelephone(profile.telephone);
      }
    }
    if (profile.notification_preferences) {
      setNotifications({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...profile.notification_preferences });
    } else {
      setNotifications(DEFAULT_NOTIFICATION_PREFERENCES);
    }
  }, [profile]);

  const loadProfileDocuments = async () => {
    if (!user) return;
    setDocsLoading(true);
    setDocsMessage(null);
    try {
      const docs = await fetchProfileDocuments(supabase, user.id);
      setStudentDoc(docs.find((d) => d.document_type === 'etudiant') ?? null);
      setMemberDoc(docs.find((d) => d.document_type === 'membre') ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement.';
      const hint = msg.includes('profile_documents')
        ? ' Exécutez la migration 014 dans Supabase (backend/migrations/014_profile_documents.sql).'
        : '';
      setDocsMessage({ type: 'error', text: `${msg}${hint}` });
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'justificatifs' && user) {
      loadProfileDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const displayName = [prenom, nom].filter(Boolean).join(' ') || 'Utilisateur';
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || 'U';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveMessage(null);

    const fullPhone = telephone ? `${countryCode} ${telephone}`.trim() : null;

    const { error } = await supabase
      .from('users_profile')
      .update({
        prenom: prenom || null,
        nom: nom || null,
        telephone: fullPhone,
        institution: institution || null,
        specialite: specialite || null,
        bio: bio.trim() || null,
        pays: pays.trim() || null,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      const hint = error.message.includes('pays')
        ? ' Exécutez la migration 036 dans Supabase (backend/migrations/036_profile_pays_and_checkin.sql).'
        : error.message.includes('bio')
        ? ' Exécutez la migration 007 dans Supabase (backend/migrations/007_profile_bio.sql).'
        : '';
      setSaveMessage({ type: 'error', text: `Erreur : ${error.message}.${hint}` });
      return;
    }

    await refreshProfile();
    setSaveMessage({ type: 'success', text: 'Profil mis à jour avec succès.' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docType || !user) return;

    setDocsUploading(docType);
    setDocsMessage(null);

    const existing = docType === 'etudiant' ? studentDoc : memberDoc;
    const { data, error } = await uploadProfileDocument(supabase, user.id, docType, file, existing);

    setDocsUploading(null);
    setDocType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (error || !data) {
      const hint = error?.includes('profile_documents') || error?.includes('profile-documents')
        ? ' Exécutez la migration 014 dans Supabase.'
        : '';
      setDocsMessage({ type: 'error', text: `${error ?? 'Échec de l\'upload.'}${hint}` });
      return;
    }

    if (docType === 'etudiant') setStudentDoc(data);
    else setMemberDoc(data);

    await refreshProfile();
    setDocsMessage({
      type: 'success',
      text: 'Document envoyé. Il sera examiné par l\'équipe organisatrice sous 48 h.',
    });
    setTimeout(() => setDocsMessage(null), 5000);
  };

  const handleDeleteDoc = async (doc: ProfileDocument) => {
    if (!user) return;
    setDocsMessage(null);
    const err = await deleteProfileDocument(supabase, user.id, doc);
    if (err) {
      setDocsMessage({ type: 'error', text: err });
      return;
    }
    if (doc.document_type === 'etudiant') setStudentDoc(null);
    else setMemberDoc(null);
    await refreshProfile();
    setDocsMessage({ type: 'success', text: 'Document supprimé.' });
    setTimeout(() => setDocsMessage(null), 3000);
  };

  const handleDownloadDoc = async (doc: ProfileDocument) => {
    const url = await getProfileDocumentSignedUrl(supabase, doc.file_url);
    if (!url) {
      setDocsMessage({ type: 'error', text: 'Impossible de télécharger le fichier.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const triggerUpload = (type: 'etudiant' | 'membre') => {
    if (docsUploading) return;
    setDocType(type);
    fileInputRef.current?.click();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    if (!passwordPattern.test(newPassword)) {
      setPasswordMessage({
        type: 'error',
        text: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.',
      });
      return;
    }

    setChangingPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setChangingPassword(false);
      setPasswordMessage({ type: 'error', text: 'Mot de passe actuel incorrect.' });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setChangingPassword(false);

    if (updateError) {
      setPasswordMessage({ type: 'error', text: updateError.message });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
    setTimeout(() => setPasswordMessage(null), 4000);
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingNotifications(true);
    setNotificationMessage(null);

    const { error } = await supabase
      .from('users_profile')
      .update({ notification_preferences: notifications })
      .eq('id', user.id);

    setSavingNotifications(false);

    if (error) {
      const hint = error.message.includes('notification_preferences') || error.message.includes('user_notifications')
        ? ' Exécutez les migrations 005 et 006 dans Supabase.'
        : '';
      setNotificationMessage({ type: 'error', text: `Erreur : ${error.message}.${hint}` });
      return;
    }

    await refreshProfile();
    setNotificationMessage({ type: 'success', text: 'Préférences enregistrées.' });
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="dashboard-content" style={{ padding: '40px', color: '#64748b' }}>
        Chargement du profil…
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="dashboard-content" style={{ padding: '40px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '8px' }}>
          <h2>Profil introuvable</h2>
          <p>Votre compte est connecté mais le profil n&apos;a pas pu être chargé. Déconnectez-vous et reconnectez-vous, ou contactez l&apos;administrateur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="header-actions" style={{ marginBottom: '30px' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {getRoleLabel(userRole)} — Gérez vos informations personnelles et vos justificatifs.
        </p>
      </div>

      {saveMessage && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: saveMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: saveMessage.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${saveMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {saveMessage.text}
        </div>
      )}

      <div className="profile-container">
        <div className="profile-sidebar">
          <div className="profile-nav">
            <button className={`profile-nav-item ${activeTab === 'informations' ? 'active' : ''}`} onClick={() => setActiveTab('informations')}>
              <span className="profile-nav-icon">👤</span> Informations générales
            </button>
            <button className={`profile-nav-item ${activeTab === 'justificatifs' ? 'active' : ''}`} onClick={() => setActiveTab('justificatifs')}>
              <span className="profile-nav-icon">📄</span> Documents justificatifs
            </button>
            <button className={`profile-nav-item ${activeTab === 'securite' ? 'active' : ''}`} onClick={() => setActiveTab('securite')}>
              <span className="profile-nav-icon">🔒</span> Mot de passe
            </button>
            <button className={`profile-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <span className="profile-nav-icon">🔔</span> Notifications
            </button>
          </div>
        </div>

        <div className="profile-content">
          {activeTab === 'informations' && (
            <form className="profile-section" onSubmit={handleSaveProfile}>
              <h2>Informations du profil</h2>

              <div className="avatar-section">
                <div className="avatar-preview"><span>{initials}</span></div>
                <div className="avatar-info">
                  <h3>{displayName}</h3>
                  <p>{user.email}</p>
                  {bio.trim() && (
                    <p className="avatar-bio-preview">
                      {bio.trim().length > 140 ? `${bio.trim().slice(0, 140)}…` : bio.trim()}
                    </p>
                  )}
                </div>
              </div>

              <div className="profile-bio-block">
                <div className="form-group-profile">
                  <label>À propos de moi</label>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
                    Présentez-vous en quelques lignes : parcours, domaine d&apos;intérêt, motivation pour les JSAN…
                    Cette description pourra être visible par les organisateurs et les autres participants.
                  </p>
                  <textarea
                    className="form-textarea-profile"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
                    placeholder="Ex. : Étudiant en nutrition à l'Université d'Abomey-Calavi, passionné par la sécurité alimentaire et les politiques nutritionnelles au Bénin."
                    maxLength={BIO_MAX_LENGTH}
                  />
                  <div className={`form-char-count ${bio.length > BIO_MAX_LENGTH * 0.9 ? 'limit-near' : ''}`}>
                    {bio.length} / {BIO_MAX_LENGTH} caractères
                  </div>
                </div>
              </div>

              <div className="profile-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
                <div className="form-group-profile">
                  <label>Prénom</label>
                  <input type="text" className="form-input-profile" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                </div>
                <div className="form-group-profile">
                  <label>Nom</label>
                  <input type="text" className="form-input-profile" value={nom} onChange={(e) => setNom(e.target.value)} />
                </div>
              </div>

              <div className="form-group-profile">
                <label>Adresse e-mail</label>
                <input type="email" className="form-input-profile" value={user.email ?? ''} readOnly style={{ background: '#f8fafc', color: '#64748b' }} />
              </div>

              {(userRole === 'auteur' || profile.institution) && (
                <div className="form-group-profile">
                  <label>Institution / Université</label>
                  <input type="text" className="form-input-profile" value={institution} onChange={(e) => setInstitution(e.target.value)} />
                </div>
              )}

              {(userRole === 'pair' || profile.specialite) && (
                <div className="form-group-profile">
                  <label>Spécialité</label>
                  <input type="text" className="form-input-profile" value={specialite} onChange={(e) => setSpecialite(e.target.value)} />
                </div>
              )}

              <div className="form-group-profile">
                <label>Pays de résidence</label>
                <select
                  className="form-input-profile"
                  value={pays}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPays(next);
                    const match = countries.find((c) => c.name === next);
                    if (match) setCountryCode(match.code);
                  }}
                >
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group-profile">
                <label>Indicatif et numéro de téléphone</label>
                <div className="profile-phone-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select className="form-input-profile" style={{ width: 'auto', minWidth: '160px', fontWeight: 500, flex: '1 1 160px' }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                    {countries.map((c, idx) => (
                      <option key={idx} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                    ))}
                  </select>
                  <input type="tel" className="form-input-profile" placeholder="Ex: 90 00 00 00" style={{ flex: '2 1 180px', minWidth: 0 }} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Mettre à jour le profil'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'justificatifs' && (
            <div className="profile-section">
              <h2>Documents Justificatifs</h2>
              <div className="profile-section-desc" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #1B6B2E', marginBottom: '25px' }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 500, color: '#1e293b' }}>
                  Afin d&apos;acheter un billet à tarif réduit, nous devons vérifier votre statut étudiant ou membre SNB.
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Formats acceptés : PDF, JPG, PNG (max 10 Mo). La validation est effectuée manuellement par l&apos;équipe organisatrice.
                </p>
              </div>

              {docsMessage && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: docsMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
                  color: docsMessage.type === 'success' ? '#166534' : '#b91c1c',
                  border: `1px solid ${docsMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
                }}>
                  {docsMessage.text}
                </div>
              )}

              {docsLoading ? (
                <p style={{ color: '#64748b', padding: '20px 0' }}>Chargement des documents…</p>
              ) : (
                <>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />

                  <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Justificatif Étudiant</h3>
                      <span className={`status-badge ${profileDocBadgeClass(studentDoc, isStudentVerified)}`}>
                        {profileDocStatusLabel(studentDoc, isStudentVerified)}
                      </span>
                    </div>
                    {studentDoc ? (
                      <div className="document-card">
                        <div className="doc-info">
                          <div className="doc-icon">📄</div>
                          <div className="doc-details">
                            <h4>{studentDoc.file_name}</h4>
                            <p>Envoyé le {formatProfileDocDate(studentDoc.created_at)}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button type="button" className="btn-save" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => handleDownloadDoc(studentDoc)}>
                            Télécharger
                          </button>
                          <button type="button" className="btn-delete" disabled={!!docsUploading} onClick={() => handleDeleteDoc(studentDoc)}>
                            Supprimer
                          </button>
                          {!isStudentVerified && (
                            <button type="button" className="btn-save" style={{ padding: '8px 14px', fontSize: '13px', background: '#64748b' }} disabled={docsUploading === 'etudiant'} onClick={() => triggerUpload('etudiant')}>
                              {docsUploading === 'etudiant' ? 'Envoi…' : 'Remplacer'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`upload-zone ${docsUploading === 'etudiant' ? 'disabled' : ''}`} onClick={() => triggerUpload('etudiant')} style={{ opacity: docsUploading === 'etudiant' ? 0.6 : 1, pointerEvents: docsUploading ? 'none' : 'auto' }}>
                        <div className="upload-icon">🎓</div>
                        <div className="upload-text">{docsUploading === 'etudiant' ? 'Envoi en cours…' : 'Uploader votre justificatif d\'étudiant'}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Justificatif Membre SNB</h3>
                      <span className={`status-badge ${profileDocBadgeClass(memberDoc, isMemberVerified)}`}>
                        {profileDocStatusLabel(memberDoc, isMemberVerified)}
                      </span>
                    </div>
                    {memberDoc ? (
                      <div className="document-card">
                        <div className="doc-info">
                          <div className="doc-icon">🏅</div>
                          <div className="doc-details">
                            <h4>{memberDoc.file_name}</h4>
                            <p>Envoyé le {formatProfileDocDate(memberDoc.created_at)}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button type="button" className="btn-save" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => handleDownloadDoc(memberDoc)}>
                            Télécharger
                          </button>
                          <button type="button" className="btn-delete" disabled={!!docsUploading} onClick={() => handleDeleteDoc(memberDoc)}>
                            Supprimer
                          </button>
                          {!isMemberVerified && (
                            <button type="button" className="btn-save" style={{ padding: '8px 14px', fontSize: '13px', background: '#64748b' }} disabled={docsUploading === 'membre'} onClick={() => triggerUpload('membre')}>
                              {docsUploading === 'membre' ? 'Envoi…' : 'Remplacer'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`upload-zone ${docsUploading === 'membre' ? 'disabled' : ''}`} onClick={() => triggerUpload('membre')} style={{ opacity: docsUploading === 'membre' ? 0.6 : 1, pointerEvents: docsUploading ? 'none' : 'auto' }}>
                        <div className="upload-icon">📄</div>
                        <div className="upload-text">{docsUploading === 'membre' ? 'Envoi en cours…' : 'Uploader votre attestation de membre SNB'}</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'securite' && (
            <form className="profile-section" onSubmit={handlePasswordChange}>
              <h2>Mot de passe & Sécurité</h2>
              <p className="profile-section-desc">
                Pour modifier votre mot de passe, saisissez d&apos;abord votre mot de passe actuel.
              </p>

              {passwordMessage && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: passwordMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
                  color: passwordMessage.type === 'success' ? '#166534' : '#b91c1c',
                  border: `1px solid ${passwordMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
                }}>
                  {passwordMessage.text}
                </div>
              )}

              <div className="form-group-profile">
                <label>Mot de passe actuel</label>
                <input
                  type="password"
                  className="form-input-profile"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="form-group-profile">
                <label>Nouveau mot de passe</label>
                <input
                  type="password"
                  className="form-input-profile"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="8+ caractères, majuscule, minuscule, chiffre"
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group-profile">
                <label>Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  className="form-input-profile"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn-save" disabled={changingPassword}>
                  {changingPassword ? 'Mise à jour…' : 'Changer le mot de passe'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <form id="preferences" className="profile-section" onSubmit={handleSaveNotifications}>
              <h2>Préférences de Notifications</h2>
              <p className="profile-section-desc">
                Gérez les alertes affichées dans l&apos;application (icône cloche) et les e-mails reçus.
              </p>

              {notificationMessage && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: notificationMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
                  color: notificationMessage.type === 'success' ? '#166534' : '#b91c1c',
                  border: `1px solid ${notificationMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
                }}>
                  {notificationMessage.text}
                </div>
              )}

              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
                🔔 Dans l&apos;application
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px' }}>
                Notifications affichées via la cloche en haut à droite du tableau de bord.
              </p>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Actualités de l&apos;événement</div>
                  <div className="toggle-desc">Programme, rappels et annonces</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.app_evenement}
                    onChange={() => toggleNotification('app_evenement')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Billetterie & paiements</div>
                  <div className="toggle-desc">Confirmations et rappels d&apos;achat</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.app_billetterie}
                    onChange={() => toggleNotification('app_billetterie')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Messagerie interne</div>
                  <div className="toggle-desc">Nouveaux messages sur la plateforme</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.app_messagerie}
                    onChange={() => toggleNotification('app_messagerie')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {showSubmissionNotifications && (
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Soumissions & évaluations</div>
                    <div className="toggle-desc">Statut des résumés et décisions</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notifications.app_soumissions}
                      onChange={() => toggleNotification('app_soumissions')}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              )}

              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '28px 0 4px' }}>
                ✉️ Par e-mail
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px' }}>
                E-mails envoyés à votre adresse de connexion.
              </p>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Actualités de l&apos;événement</div>
                  <div className="toggle-desc">Programme, rappels et annonces générales</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.email_evenement}
                    onChange={() => toggleNotification('email_evenement')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Billetterie & paiements</div>
                  <div className="toggle-desc">Confirmations d&apos;achat et reçus</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.email_billetterie}
                    onChange={() => toggleNotification('email_billetterie')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Messagerie interne</div>
                  <div className="toggle-desc">Nouveaux messages reçus sur la plateforme</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.email_messagerie}
                    onChange={() => toggleNotification('email_messagerie')}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {showSubmissionNotifications && (
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Soumissions & évaluations</div>
                    <div className="toggle-desc">Statut des résumés, décisions et rappels</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notifications.email_soumissions}
                      onChange={() => toggleNotification('email_soumissions')}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="submit" className="btn-save" disabled={savingNotifications}>
                  {savingNotifications ? 'Enregistrement…' : 'Enregistrer les préférences'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

