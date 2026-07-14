"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '../styles/dashboard.css';
import { useAuth } from '../AuthContext';
import { isEventStaff, isSuperAdmin, getRoleLabel } from '@/lib/roles';
import NotificationBell from '@/components/dashboard/NotificationBell';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResumesOpen, setIsResumesOpen] = useState(true);
  const [isArticlesOpen, setIsArticlesOpen] = useState(true);
  const [isOutilsOpen, setIsOutilsOpen] = useState(true);
  // Organizer Drawers
  const [isGestionScientifiqueOpen, setIsGestionScientifiqueOpen] = useState(true);
  const [isProgrammeOpen, setIsProgrammeOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isRapportsOpen, setIsRapportsOpen] = useState(false);
  const { isLoggedIn, isLoading, userRole, profile, user, signOut, isEvaluatorApproved } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      window.location.href = '/login?role=participant';
    }
  }, [isLoggedIn, isLoading]);

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('dashboard-body');
    
    // Handle outside click for dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      document.body.classList.remove('dashboard-body');
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isSidebarOpen]);

  if (!mounted || isLoading) {
    return (
      <div className="dashboard-body" style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Chargement…
      </div>
    );
  }

  let pageTitle = "Tableau de bord";
  switch (pathname) {
    case '/dashboard/mes-resumes': pageTitle = "Mes Résumés"; break;
    case '/dashboard/nouvelle-soumission': pageTitle = "Nouvelle Soumission"; break;
    case '/dashboard/brouillons-resumes': pageTitle = "Brouillons de Résumés"; break;
    case '/dashboard/statut-evaluations': pageTitle = "Statut des évaluations"; break;
    case '/dashboard/nouvel-article': pageTitle = "Nouvel Article"; break;
    case '/dashboard/brouillons-articles': pageTitle = "Brouillons d'Articles"; break;
    case '/dashboard/articles-complets': pageTitle = "Articles complets"; break;
    case '/dashboard/messagerie': pageTitle = "Messagerie"; break;
    case '/dashboard/billetterie': pageTitle = "Billetterie & Événement"; break;
    case '/dashboard/badge': pageTitle = "Mon badge"; break;
    case '/dashboard/programme': pageTitle = "Programme"; break;
    case '/dashboard/comite': pageTitle = "Comité d'organisation"; break;
    case '/dashboard/bibliotheque': pageTitle = "Bibliothèque"; break;
    case '/dashboard/attestations': pageTitle = "Mes attestations"; break;
    case '/dashboard/parametres': pageTitle = "Paramètres"; break;
    case '/dashboard/utilisateurs': pageTitle = "Gestion des Utilisateurs"; break;
    case '/dashboard/profil': pageTitle = "Mon Profil & Justificatifs"; break;
    case '/dashboard/resumes-a-evaluer': pageTitle = "Résumés à évaluer"; break;
    case '/dashboard/articles-a-evaluer': pageTitle = "Articles à évaluer"; break;
    
    // Organizer Routes
    case '/dashboard/admin/soumissions': pageTitle = "Gestion des Soumissions"; break;
    case '/dashboard/admin/evaluateurs': pageTitle = "Gestion des Évaluateurs"; break;
    case '/dashboard/admin/bibliotheque': pageTitle = "Bibliothèque Scientifique"; break;
    case '/dashboard/admin/programme': pageTitle = "Programme & Sessions"; break;
    case '/dashboard/admin/salles': pageTitle = "Gestion des Salles"; break;
    case '/dashboard/admin/visioconferences': pageTitle = "Visioconférences & Streaming"; break;
    case '/dashboard/admin/check-in': pageTitle = "Check-in jour J"; break;
    case '/dashboard/admin/inscriptions': pageTitle = "Inscriptions & Participants"; break;
    case '/dashboard/admin/paiements': pageTitle = "Paiements & Billetterie"; break;
    case '/dashboard/admin/sponsors': pageTitle = "Sponsors & Partenaires"; break;
    case '/dashboard/admin/emails': pageTitle = "E-mails & Annonces"; break;
    case '/dashboard/admin/blog': pageTitle = "Blog & Newsletter"; break;
    case '/dashboard/admin/documents': pageTitle = "Génération de Documents"; break;
    case '/dashboard/admin/rapports': pageTitle = "Rapports & Statistiques"; break;
  }

  return (
    <div className="dashboard-body" style={{ width: '100%', minHeight: '100vh', display: 'flex' }}>
      
      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar${isSidebarOpen ? ' is-open' : ''}`}>
        <div className="sidebar-logo">
          <Link href="/" onClick={() => setIsSidebarOpen(false)}>
            <img src="/media/media_library/logo-jsan.png" alt="JSAN Logo" style={{ height: '45px', width: 'auto', objectFit: 'contain', cursor: 'pointer' }} />
          </Link>
        </div>

        <div className="sidebar-section-title">
          {userRole === 'participant' ? 'Espace Participant' :
           userRole === 'pair' ? (isEvaluatorApproved ? 'Espace Évaluateur' : 'Espace Évaluateur (en attente)') :
           userRole === 'organisateur' ? 'Espace Organisateur' :
           userRole === 'superadmin' ? 'Espace Super Admin' : 'Espace Auteur'}
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
                <span className="icon">📊</span> Tableau de bord
              </Link>
            </li>

            {/* Résumés - Visible pour auteur, pair et organisateur */}
            {(userRole === 'auteur' || userRole === 'pair' || isEventStaff(userRole)) && (
            <>
            <div 
              className="sidebar-section-title" 
              style={{ marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsResumesOpen(!isResumesOpen)}
            >
              <span>Mes RÉSUMÉS</span>
              <span style={{ fontSize: '10px', transform: isResumesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#94a3b8' }}>▼</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateRows: isResumesOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease-out' }}>
              <div style={{ overflow: 'hidden' }}>
                <li>
                  <Link href="/dashboard/nouvelle-soumission" className={pathname === '/dashboard/nouvelle-soumission' ? 'active' : ''}>
                    <span className="icon">➕</span> Nouveau Résumé
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/brouillons-resumes" style={{ paddingLeft: '50px', color: '#94a3b8' }} className={`submenu-item ${pathname === '/dashboard/brouillons-resumes' ? 'active' : ''}`}>
                    Brouillons
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/mes-resumes" className={pathname === '/dashboard/mes-resumes' ? 'active' : ''}>
                    <span className="icon">📄</span> Résumés soumis
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/statut-evaluations" className={pathname === '/dashboard/statut-evaluations' ? 'active' : ''}>
                    <span className="icon">⏳</span> Statut des évaluations
                  </Link>
                </li>
              </div>
            </div>
            </>
            )}

            {/* Articles - Visible pour auteur, pair et organisateur */}
            {(userRole === 'auteur' || userRole === 'pair' || isEventStaff(userRole)) && (
            <>
            <div 
              className="sidebar-section-title" 
              style={{ marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsArticlesOpen(!isArticlesOpen)}
            >
              <span>Mes Articles</span>
              <span style={{ fontSize: '10px', transform: isArticlesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#94a3b8' }}>▼</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateRows: isArticlesOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease-out' }}>
              <div style={{ overflow: 'hidden' }}>
                <li>
                  <Link href="/dashboard/nouvel-article" className={pathname === '/dashboard/nouvel-article' ? 'active' : ''}>
                    <span className="icon">➕</span> Nouvel Article
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/brouillons-articles" style={{ paddingLeft: '50px', color: '#94a3b8' }} className={`submenu-item ${pathname === '/dashboard/brouillons-articles' ? 'active' : ''}`}>
                    Brouillons
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/articles-complets" className={pathname === '/dashboard/articles-complets' ? 'active' : ''}>
                    <span className="icon">📄</span> Articles complets
                  </Link>
                </li>
              </div>
            </div>
            </>
            )}

            {/* Évaluations - Visible pour pair et organisateur */}
            {((userRole === 'pair' && isEvaluatorApproved) || isEventStaff(userRole)) && (
            <>
            <div 
              className="sidebar-section-title" 
              style={{ marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsResumesOpen(!isResumesOpen)}
            >
              <span>Évaluations</span>
              <span style={{ fontSize: '10px', transform: isResumesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#94a3b8' }}>▼</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateRows: isResumesOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease-out' }}>
              <div style={{ overflow: 'hidden' }}>
                <li>
                  <Link href="/dashboard/resumes-a-evaluer" className={pathname === '/dashboard/resumes-a-evaluer' ? 'active' : ''}>
                    <span className="icon">⏳</span> Résumés à évaluer
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/articles-a-evaluer" className={pathname === '/dashboard/articles-a-evaluer' ? 'active' : ''}>
                    <span className="icon">📑</span> Articles à évaluer
                  </Link>
                </li>
              </div>
            </div>
            </>
            )}

            {/* Outils - Visible par tout le monde */}
            <div 
              className="sidebar-section-title" 
              style={{ marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsOutilsOpen(!isOutilsOpen)}
            >
              <span>Outils</span>
              <span style={{ fontSize: '10px', transform: isOutilsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#94a3b8' }}>▼</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateRows: isOutilsOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease-out' }}>
              <div style={{ overflow: 'hidden' }}>
                <li><Link href="/dashboard/programme" className={pathname === '/dashboard/programme' ? 'active' : ''}><span className="icon">📅</span> Programme</Link></li>
                <li>
                  <Link
                    href="/dashboard/comite"
                    className={pathname === '/dashboard/comite' ? 'active' : ''}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <span className="icon">👥</span> Comité
                  </Link>
                </li>
                <li><Link href="/dashboard/bibliotheque" className={pathname === '/dashboard/bibliotheque' ? 'active' : ''}><span className="icon">📚</span> Bibliothèque</Link></li>
                <li><Link href="/dashboard/messagerie" className={pathname === '/dashboard/messagerie' ? 'active' : ''}><span className="icon">✉️</span> Messagerie</Link></li>
                <li><Link href="/dashboard/billetterie" className={pathname === '/dashboard/billetterie' ? 'active' : ''}><span className="icon">🎟️</span> Billetterie</Link></li>
                <li><Link href="/dashboard/badge" className={pathname === '/dashboard/badge' ? 'active' : ''}><span className="icon">🪪</span> Mon badge</Link></li>
                <li><Link href="/dashboard/attestations" className={pathname === '/dashboard/attestations' ? 'active' : ''}><span className="icon">🏅</span> Attestations</Link></li>
                
                {isEventStaff(userRole) && (
                  <li><Link href="/dashboard/parametres" className={pathname === '/dashboard/parametres' ? 'active' : ''}><span className="icon">⚙️</span> Paramètres</Link></li>
                )}
              </div>
            </div>

          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main" style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>
        
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={isSidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((open) => !open)}
            >
              {isSidebarOpen ? '✕' : '☰'}
            </button>
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          
          <div className="topbar-right">
            
            {pathname !== '/dashboard/nouvelle-soumission' && (userRole === 'auteur' || userRole === 'pair' || isEventStaff(userRole)) && (
              <Link
                href="/dashboard/nouvelle-soumission"
                className="btn btn-primary topbar-cta"
                style={{ backgroundColor: 'var(--jsan-green)', color: '#ffffff', borderRadius: '8px', padding: '6px 16px', fontWeight: 600, fontSize: '13px', border: 'none', boxShadow: '0 4px 12px rgba(27,107,46,0.28)', whiteSpace: 'nowrap' }}
              >
                <span className="topbar-cta-label">Soumettre un résumé</span>
                <span className="topbar-cta-icon" aria-hidden style={{ display: 'none' }}>➕</span>
              </Link>
            )}

            <NotificationBell />

            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', 
                  backgroundColor: isSuperAdmin(userRole) ? 'var(--jsan-green-dark)' : isEventStaff(userRole) ? 'var(--jsan-red)' : 'var(--jsan-green)', 
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 'bold', cursor: 'pointer', border: '2px solid #fff', 
                  boxShadow: '0 2px 10px rgba(27,107,46,0.2)', transition: 'transform 0.2s',
                  transform: isProfileOpen ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                {(profile?.prenom?.[0] ?? 'J')}{(profile?.nom?.[0] ?? 'D')}
              </div>
              
              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="dashboard-profile-menu">
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {profile ? `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim() || getRoleLabel(userRole) : getRoleLabel(userRole)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user?.email ?? ''}</div>
                  </div>
                  
                  <Link href="/dashboard/profil" onClick={() => setIsProfileOpen(false)} style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: '#475569', cursor: 'pointer', fontSize: '0.9rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                      <span style={{ fontSize: '16px' }}>👤</span> Mon Profil & Justificatifs
                    </div>
                  </Link>

                  {/* 🔴 ADMINISTRATION ERP (ORGANISATEUR SEULEMENT) */}
                  {isEventStaff(userRole) && (
                    <>
                      <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }}></div>
                      
                      <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 16px', fontWeight: 600 }}>🔬 Gestion Scientifique</div>
                      <Link href="/dashboard/admin/soumissions" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📥</span> Soumissions
                      </Link>
                      <Link href="/dashboard/admin/evaluateurs" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>⚖️</span> Évaluateurs
                      </Link>
                      <Link href="/dashboard/admin/bibliotheque" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📚</span> Bibliothèque
                      </Link>

                      <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 16px', fontWeight: 600, marginTop: '4px' }}>📅 Programme & Salles</div>
                      <Link href="/dashboard/admin/programme" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📋</span> Sessions
                      </Link>
                      <Link href="/dashboard/admin/salles" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>🚪</span> Salles physiques
                      </Link>
                      <Link href="/dashboard/admin/visioconferences" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>💻</span> Visioconférences
                      </Link>

                      <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 16px', fontWeight: 600, marginTop: '4px' }}>👥 Finances & Participants</div>
                      <Link href="/dashboard/utilisateurs" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>🎫</span> Inscriptions
                      </Link>
                      <Link href="/dashboard/admin/check-in" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>✅</span> Check-in
                      </Link>
                      <Link href="/dashboard/admin/paiements" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>💳</span> Paiements
                      </Link>
                      <Link href="/dashboard/admin/sponsors" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>🤝</span> Sponsors
                      </Link>
                      <Link href="/dashboard/admin/emails" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📨</span> E-mails
                      </Link>
                      <Link href="/dashboard/admin/blog" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📰</span> Blog & Newsletter
                      </Link>

                      <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 16px', fontWeight: 600, marginTop: '4px' }}>📊 Rapports & Docs</div>
                      <Link href="/dashboard/admin/documents" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📄</span> Générer Docs
                      </Link>
                      <Link href="/dashboard/admin/rapports" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '14px' }}>📈</span> Statistiques
                      </Link>
                      <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }}></div>
                    </>
                  )}

                  {isEventStaff(userRole) && (
                    <>
                      <Link href="/dashboard/profil#preferences" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.9rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '16px' }}>✨</span> Préférences
                      </Link>
                      <Link href="/dashboard/parametres" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.9rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <span style={{ fontSize: '16px' }}>⚙️</span> Paramètres
                      </Link>
                    </>
                  )}

                  {!isEventStaff(userRole) && (
                    <Link href="/dashboard/profil#preferences" onClick={() => setIsProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: '#475569', textDecoration: 'none', fontSize: '0.9rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                      <span style={{ fontSize: '16px' }}>✨</span> Préférences
                    </Link>
                  )}
                  
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }}></div>
                  
                  <div onClick={() => { signOut(); window.location.href = '/login'; }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 
                    Déconnexion
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Content Area */}
        <div className="dashboard-content">
          <div className="dashboard-content-body">
            {children}
          </div>
          <footer className="dashboard-footer">
            Journées Scientifiques de l&apos;Alimentation et de la Nutrition (JSAN) — Version 2.0
            {' · '}
            Conçu par{' '}
            <a href="https://guelichweb.online/" target="_blank" rel="noopener noreferrer">
              Guelichweb
            </a>
          </footer>
        </div>

      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
