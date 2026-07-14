"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import CustomSelect from '../components/CustomSelect';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchSponsors, getSponsorLogoUrl, groupSponsorsByLevel, SPONSOR_LEVEL_COLORS, type EventSponsor } from '@/lib/sponsors';
import { TICKET_CATALOG } from '@/lib/tickets';
import { useRegistrationsOpen } from '@/hooks/use-registrations-open';

export default function Home() {
  const { isLoggedIn, isStudentVerified, isMemberVerified } = useAuth();
  const registrationsOpen = useRegistrationsOpen();
  const supabase = useMemo(() => createClient(), []);
  const [customAlert, setCustomAlert] = useState<{ show: boolean, message: string, action?: () => void }>({ show: false, message: '' });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterNotice, setNewsletterNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [contactNom, setContactNom] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactNotice, setContactNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const tickets = TICKET_CATALOG;

  const handleBuyKkiapay = (ticketTitle: string) => {
    if (!isLoggedIn) {
      window.location.href = '/login?role=participant';
      return;
    }

    const isStudentTicket = ticketTitle.toLowerCase().includes('étudiant');
    const isMemberTicket = ticketTitle.toLowerCase().includes('membre snb');

    if (isStudentTicket && !isStudentVerified) {
      setCustomAlert({
        show: true, 
        message: "Ce ticket est réservé aux étudiants. Veuillez uploader et faire valider votre carte d'étudiant dans votre Profil avant de procéder à l'achat.",
        action: () => window.location.href = '/dashboard/profil'
      });
      return;
    }

    if (isMemberTicket && !isMemberVerified) {
      setCustomAlert({
        show: true, 
        message: "Ce ticket est réservé aux membres de la SNB. Veuillez uploader et faire valider votre attestation de membre dans votre Profil avant de procéder à l'achat.",
        action: () => window.location.href = '/dashboard/profil'
      });
      return;
    }

    // Le paiement se fait dans la billetterie du dashboard (liens Kkiapay par billet).
    window.location.href = '/dashboard/billetterie';
  };

  const handleNewsletterSubscribe = async () => {
    const email = newsletterEmail.trim();
    if (!email) {
      setNewsletterNotice({ type: 'error', text: 'Saisissez votre adresse e-mail.' });
      return;
    }

    setNewsletterLoading(true);
    setNewsletterNotice(null);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNewsletterNotice({ type: 'error', text: data.message || 'Inscription impossible.' });
        return;
      }
      setNewsletterEmail('');
      setNewsletterNotice({ type: 'success', text: data.message || 'Inscription confirmée !' });
    } catch {
      setNewsletterNotice({ type: 'error', text: 'Erreur réseau. Réessayez.' });
    } finally {
      setNewsletterLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactNotice(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: contactNom.trim(),
          email: contactEmail.trim(),
          message: contactMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setContactNotice({ type: 'error', text: data.message || 'Envoi impossible.' });
        return;
      }
      setContactNom('');
      setContactEmail('');
      setContactMessage('');
      setContactNotice({ type: 'success', text: data.message || 'Message envoyé.' });
    } catch {
      setContactNotice({ type: 'error', text: 'Erreur réseau. Réessayez.' });
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    async function loadSponsors() {
      const rows = await fetchSponsors(supabase, { activeOnly: true });
      setSponsors(rows);
    }
    void loadSponsors();
  }, [supabase]);

  // Ré-init le slider après les re-renders React (sponsors / auth), sinon flèches + menu cassent
  useEffect(() => {
    const t = window.setTimeout(() => {
      window.initJsanHomeSlider?.({ reset: false });
    }, 50);
    return () => window.clearTimeout(t);
  }, [sponsors, isLoggedIn, registrationsOpen]);

  return (
    <>
      <Script src="/script.js" strategy="afterInteractive" onLoad={() => window.initJsanHomeSlider?.({ reset: true })} />
      

  {/* ===== NAVBAR ===== */}
  <nav className="navbar" id="navbar">
    <div className="container">
      <a href="#accueil" className="navbar-brand">
        <img src="/media/media_library/logo-jsan.png" alt="SNB Logo" className="navbar-logo-img" style={{"height":"50px","width":"auto","maxWidth":"200px","objectFit":"contain","flexShrink":"0"}} />
      </a>
      <div className="nav-links" id="navLinks">
        <a href="#accueil" className="active">Accueil</a>
        <a href="#intro">JSAN</a>
        <a href="#apropos">À Propos</a>
        <a href="#objectifs">Thématiques</a>
        <a href="#programme">Programme</a>
        <a href="#participer">Participer</a>
        <a href="#tarifs">Tarifs</a>
        <a href="#partenaires">Partenaires</a>
        <Link href="/blog">Blog</Link>
        <a href="#faq">FAQ</a>
        <div className="nav-cta-mobile hidden-desktop">
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary">Tableau de bord</Link>
          ) : (
            <>
              {registrationsOpen !== false && (
                <Link href="/register?role=participant" className="btn btn-outline">Inscription</Link>
              )}
              <Link href="/login" className="btn btn-primary">Se connecter</Link>
            </>
          )}
        </div>
      </div>
      <div className="nav-cta">
        {isLoggedIn ? (
          <Link href="/dashboard" className="btn btn-primary btn-sm">Tableau de bord</Link>
        ) : (
          <>
            {registrationsOpen !== false && (
              <Link href="/register?role=participant" className="btn btn-outline btn-sm">Inscription</Link>
            )}
            <Link href="/login" className="btn btn-primary btn-sm">Se connecter</Link>
          </>
        )}
      </div>
      <button className="hamburger" id="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <div id="slider-wrapper">

  {/* ===== HERO ===== */}
  <section className="hero" id="accueil">
    <div className="container hero-container">
      <div className="hero-content">
        <h1 className="hero-title">JSAN 2025</h1>
        <p className="hero-subtitle">1ère Edition</p>
        <div className="hero-divider"></div>
        <p className="hero-description">
          Situation nutritionnelle en Afrique face aux défis actuels des systèmes alimentaires : quel horizon d'ici 2030 ?
        </p>
      </div>
    </div>
    
    <div className="hero-cards-container">
      <div className="container">
        <div className="hero-cards-grid">
          <div className="hero-card hero-card-date">
            <div className="hero-card-date-info">
              <span className="hero-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div className="hero-card-text">
                <strong>Mardi 10 au Samedi 14</strong><br />
                Juin 2025
              </div>
            </div>
            <div className="hero-card-divider hidden-mobile"></div>
            <div className="hero-card-location-info">
              <span className="hero-card-icon-location">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div className="hero-card-text-location">
                <strong>Où se déroule l'événement :</strong><br />
                Palais des Congrès, Cotonou, Bénin
              </div>
            </div>
          </div>
          <div className="hero-card hero-card-announcement">
            <div className="hero-card-text">
              <strong>LES JSAN 2025 SONT TERMINEES…</strong><br />
              MERCI POUR VOTRE PARTICIPATION !
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="hero-wave">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,96 C280,192 560,0 840,48 C1120,96 1280,48 1440,12 V120 H0 Z" fill="#ffffff" />
      </svg>
    </div>
  </section>


  {/* ===== FIRST EDITION INTRO ===== */}
  <section className="section edition-intro-section" id="intro" style={{ backgroundColor: "var(--white)", color: "var(--text-body)" }}>
    <div className="container edition-intro-grid">
      <div className="edition-intro-collage trio-images">
        <img src="/media/media_library/jsan_cercle.png" alt="JSAN 2025 Image 1" className="collage-img-1" />
        <img src="/media/media_library/jsan_cercle2.png" alt="JSAN 2025 Image 2" className="collage-img-2 hidden-mobile" />
        <img src="/media/media_library/jsan_cercle3.png" alt="JSAN 2025 Image 3" className="collage-img-3 hidden-mobile" />
      </div>
      <div className="edition-intro-content">
        <div className="success-badge">🎉 MERCI ! Les JSAN 2025 ont été un succès !</div>
        <h2>La 1<sup>re</sup> édition des Journées Scientifiques de l'Alimentation et de la Nutrition (JSAN 2025)</h2>
        <p className="edition-intro-sub">organisée par la Société de Nutrition du Bénin, s'est déroulée du <strong>10 au 14 juin 2025</strong> au <strong>Palais des Congrès de Cotonou</strong>, en présentiel et en ligne.</p>
        
        <ul className="edition-stats-list">
          <li><span className="bullet-check">✔</span> Des <strong>participants</strong> nationaux et internationaux</li>
          <li><span className="bullet-check">✔</span> Des <strong>communications scientifiques</strong> orales et posters</li>
          <li><span className="bullet-check">✔</span> Des <strong>échanges riches</strong> autour des enjeux alimentaires en Afrique</li>
          <li><span className="bullet-check">✔</span> Des <strong>formations, panels et expositions</strong> interactives</li>
        </ul>
        
        <p className="thank-you-text hidden-mobile">🙏 Nous remercions chaleureusement tous les auteurs, intervenants, évaluateurs, modérateurs, bénévoles, partenaires et participants pour leur engagement et leur professionnalisme.</p>
        
        
      </div>
    </div>
  </section>

  {/* ===== ABOUT SECTION ===== */}
  <section className="section section-alt" id="apropos">
    <div className="container">
      <div className="about-grid">
        {/* Left: Image + Accordion */}
        <div className="about-image-column">
          <div className="accordion-section">
            <div className="accordion-item active">
              <div className="accordion-header" onClick={(e) => window.toggleAccordion(e.currentTarget)}>
                Mots du président de la SNB
                <span className="chevron">▲</span>
              </div>
              <div className="accordion-body">
                <p>Chers collègues et partenaires de la nutrition en Afrique,</p>
                <p>C'est avec un immense plaisir que je vous adresse mes salutations pour ces premières Journées Scientifiques d'Alimentation et de Nutrition au Bénin. Ce rendez-vous représente une opportunité exceptionnelle pour échanger, partager nos avancées et nos défis en matière de nutrition. Ensemble, explorons les horizons d'ici 2030 pour un avenir alimentaire durable en Afrique.</p>
                <p>Bien à vous,</p>
                <p className="author">Evariste C. Mitchikpè</p>
              </div>
            </div>
            <div className="accordion-item">
              <div className="accordion-header" onClick={(e) => window.toggleAccordion(e.currentTarget)}>
                Mot de la présidente du comité d'organisation :
                <span className="chevron">▼</span>
              </div>
              <div className="accordion-body">
                <p>Chères et chers collègues,</p>
                <p>Je suis honorée de présider le comité d'organisation des JSAN 2025. Notre équipe s'engage à faire de cet événement un moment de partage scientifique et d'échanges fructueux. Avec votre collaboration, nous réussirons à mettre en lumière les enjeux cruciaux des systèmes alimentaires en Afrique et à tracer ensemble les voies vers un avenir nourrissant et équilibré pour tous.</p>
                <p>Avec enthousiasme,</p>
                <p className="author">Colette S. Azandjèmè</p>
              </div>
            </div>
          </div>
          <p style={{"marginTop":"20px","fontSize":"0.95rem","color":"var(--text-light)","lineHeight":"1.6"}}>
            La SNB est une société savante dédiée à la promotion de la nutrition au Bénin. En organisant les JSAN, la SNB offre une plateforme d'échange et de collaboration entre chercheurs, praticiens et acteurs politiques.
          </p>
          <Link href="https://snb.bj/" target="_blank" rel="noopener noreferrer" className="snb-link">SNB : EN SAVOIR PLUS → </Link>
        </div>

        {/* Right: About text */}
        <div className="about-text">
          <h2>À Propos</h2>
          <p className="hidden-mobile">L'Afrique est confrontée à des défis majeurs en matière de sécurité alimentaire et de nutrition exacerbés par le changement climatique, la croissance démographique, la pauvreté, les conflits, et les tendances géopolitiques. Les JSAN sont initiées pour créer un cadre de partage d'expériences et d'analyse face aux défis.</p>
          <p className="hidden-mobile">En participant aux JSAN, vous contribuez aux débats sur les grandes problématiques actuelles de la nutrition. Les JSAN permettent le partage des résultats et découvertes de recherches en nutrition, le renforcement des capacités des professionnels, favorisent les échanges et les partenariats et aboutissent à des recommandations d'actions concrètes.</p>
          <p>Les JSAN visent à créer une plateforme de partage d'expériences et d'analyses face aux défis alimentaires et nutritionnels en Afrique. Le thème de cette première édition est :</p>
          <p className="theme-highlight">Situation nutritionnelle en Afrique face aux défis actuels des systèmes alimentaires : quel horizon d'ici 2030 ?</p>
        </div>
      </div>
    </div>
  </section>

  {/* ===== TABS: Objectifs / Thématiques / Hébergement ===== */}
  <section className="section section-alt" id="objectifs">
    <div className="container">
      <h2 className="section-title reveal">Objectifs & Thématiques</h2>
      <div className="tabs-wrapper reveal">
        <div className="tabs-header">
          <button className="tab-btn active" data-tab="objectifs-tab" onClick={(e) => window.switchTab(e.currentTarget)}>
            <span className="tab-icon">🎯</span>
            Objectifs
          </button>
          <button className="tab-btn" data-tab="thematiques-tab" onClick={(e) => window.switchTab(e.currentTarget)}>
            <span className="tab-icon">🔗</span>
            Thématiques
          </button>
          <button className="tab-btn" data-tab="hebergement-tab" onClick={(e) => window.switchTab(e.currentTarget)}>
            <span className="tab-icon">🏨</span>
            Hébergement
          </button>
        </div>
        <div className="tab-content">
          {/* Objectifs */}
          <div className="tab-pane active" id="objectifs-tab">
            <h3><span className="emoji">📌</span> Objectifs spécifiques des JSAN</h3>
            <div className="objectif-item">
              <span className="number">1</span>
              <span className="main-text">Analyser les enjeux actuels de la sécurité alimentaire et de la nutrition</span>
              <span className="sub-text hidden-mobile">Proposer des solutions innovantes pour améliorer la résilience alimentaire.</span>
            </div>
            <div className="objectif-item">
              <span className="number">2</span>
              <span className="main-text">Mettre en lumière les recherches et interventions sur la nutrition au cours des 1000 premiers jours de vie</span>
              <span className="sub-text hidden-mobile">Identifier les lacunes et axes d'investissement prioritaires.</span>
            </div>
            <div className="objectif-item">
              <span className="number">3</span>
              <span className="main-text">Analyser la situation et les interventions nutritionnelles en milieu scolaire et du jeune enfant</span>
              <span className="sub-text hidden-mobile">Renforcer les politiques existantes en matière de nutrition scolaire.</span>
            </div>
            <div className="objectif-item">
              <span className="number">4</span>
              <span className="main-text">Promouvoir la recherche scientifique et les bonnes pratiques en alimentation et nutrition</span>
              <span className="sub-text hidden-mobile">Encourager l'échange de connaissances et le développement de nouvelles approches.</span>
            </div>
            <div className="objectif-item">
              <span className="number">5</span>
              <span className="main-text">Renforcer les capacités des professionnels et acteurs du domaine de la nutrition</span>
              <span className="sub-text hidden-mobile">Former et outiller les intervenants pour une meilleure gestion des défis nutritionnels.</span>
            </div>
            <div className="objectif-item">
              <span className="number">6</span>
              <span className="main-text">Proposer des actions concrètes pour améliorer les tendances actuelles et accélérer l'atteinte des ODD</span>
              <span className="sub-text hidden-mobile">Mettre en place des stratégies impactantes pour lutter contre la malnutrition et renforcer la sécurité alimentaire.</span>
            </div>
          </div>

          {/* Thématiques */}
          <div className="tab-pane" id="thematiques-tab">
            <h3><span className="emoji">📌</span> Thématiques de la conférence :</h3>
            <div className="objectif-item">
              <span className="number">1</span>
              <span className="main-text">Analyse de la situation alimentaire et nutritionnelle</span>
            </div>
            <div className="objectif-item">
              <span className="number">2</span>
              <span className="main-text">Biotechnologie, transformation agroalimentaire et sécurité sanitaire des aliments</span>
            </div>
            <div className="objectif-item">
              <span className="number">3</span>
              <span className="main-text">Souveraineté alimentaire, changement climatique et résilience</span>
            </div>
            <div className="objectif-item">
              <span className="number">4</span>
              <span className="main-text">Interventions nutritionnelles et approches innovantes</span>
            </div>
            <div className="objectif-item">
              <span className="number">5</span>
              <span className="main-text">Nutrition clinique et santé des populations</span>
            </div>
          </div>

          {/* Hébergement */}
          <div className="tab-pane" id="hebergement-tab">
            <h3><span className="emoji">📌</span> Hébergement pour les participants des JSAN 2025</h3>
            <div className="hebergement-content">
              <p>◆ Les participants sont responsables de la réservation de leur hébergement, selon leurs préférences et leur budget.</p>
              <p>◆ Les organisateurs ont sélectionné une liste d'hôtels situés à proximité du lieu de la conférence, certains proposant des <strong>tarifs préférentiels</strong> aux participants.</p>
              <p>◆ Consultez la liste des hôtels disponibles et leurs coordonnées ici :<br />
              <Link href="#" className="hotel-link">📁 Accéder à la liste des hôtels</Link></p>
              <p className="warning-text">⚠ Pour toute assistance ou information complémentaire, n'hésitez pas à contacter l'équipe des JSAN 2025.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* ===== PROGRAMME / TIMELINE ===== */}
  <section className="section" id="programme" style={{ backgroundColor: "var(--white)", color: "var(--text-body)" }}>
    <div className="container">
      <h2 className="section-title reveal">PROGRAMME</h2>
      <div className="timeline reveal">
        {/* Item 1 */}
        <div className="timeline-item">
          <div className="timeline-dot">📄</div>
          <div className="timeline-date hidden-mobile">16-24 juin 2025</div>
          <div className="timeline-card">
            <h4>Dépôt des articles après JSAN</h4>
            <p>16-24 juin 2025</p>
          </div>
        </div>
        {/* Item 2 */}
        <div className="timeline-item">
          <div className="timeline-dot">📄</div>
          <div className="timeline-date hidden-mobile">30-juin-25</div>
          <div className="timeline-card" style={{"background":"#388e3c"}}>
            <h4>Publication des actes des JSAN</h4>
            <p>30-juin-25</p>
          </div>
        </div>
        {/* Item 3 */}
        <div className="timeline-item">
          <div className="timeline-dot">📄</div>
          <div className="timeline-date hidden-mobile">15-sept.-25</div>
          <div className="timeline-card" style={{"background":"#5a7a3a"}}>
            <h4>Publication du numéro spécial du Journal de la SNB</h4>
            <p>15-sept.-25</p>
          </div>
        </div>
      </div>
      <div style={{"textAlign":"center","marginTop":"40px"}} className="reveal">
        <Link href="#" className="btn btn-primary" id="btn-download-programme">
          <span style={{"marginRight":"8px"}}>📥</span> Télécharger le programme
        </Link>
      </div>
    </div>
  </section>

  {/* ===== WHY PARTICIPATE ===== */}
  <section className="section section-dark" id="participer">
    <div className="container">
      <h2 className="section-title reveal">Pourquoi participer aux JSAN 2025 ?</h2>
      <div className="why-grid reveal">
        <div className="why-card">
          <div className="card-number">01</div>
          <div className="card-icon">🎓</div>
          <h4>Accédez à des conférences de haut niveau</h4>
          <p className="hidden-mobile">Bénéficiez de présentations par des experts internationaux en nutrition et sécurité alimentaire.</p>
        </div>
        <div className="why-card">
          <div className="card-number">02</div>
          <div className="card-icon">🤝</div>
          <h4>Renforcez vos réseaux professionnels</h4>
          <p className="hidden-mobile">Échangez avec des chercheurs, professionnels et décideurs du domaine de la nutrition en Afrique.</p>
        </div>
        <div className="why-card">
          <div className="card-number">03</div>
          <div className="card-icon">💡</div>
          <h4>Contribuez aux solutions durables</h4>
          <p className="hidden-mobile">Participez activement à l'élaboration de recommandations pour améliorer la sécurité alimentaire.</p>
        </div>
      </div>
    </div>
  </section>

  {/* ===== TARIFS / PRICING ===== */}
  <section className="section pricing-section" id="tarifs" style={{ scrollMarginTop: '120px', paddingTop: '120px' }}>
    <div className="container">
      <h2 className="section-title reveal" style={{ marginBottom: '40px' }}>Tarifs d'inscription</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', paddingBottom: '40px' }} className="reveal">
        {tickets.map(ticket => (
          <div key={ticket.id} style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
            {/* Image Card */}
            <div style={{ height: '180px', position: 'relative' }}>
              <img src={ticket.img} alt={ticket.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                {ticket.category}
              </span>
            </div>
            
            {/* Content */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3 style={{ fontSize: '18px', color: '#0f172a', margin: '0 0 8px 0' }}>{ticket.title}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5, flex: 1 }}>{ticket.desc}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{ticket.price}</span>
                <button 
                  onClick={() => handleBuyKkiapay(ticket.title)}
                  style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  Acheter
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* ===== PARTNERS ===== */}
  <section className="partners-section" id="partenaires">
    <div className="container">
      <h2 className="section-title reveal">Nos Partenaires</h2>
      {sponsors.length === 0 ? (
        <div className="partners-container reveal" style={{ textAlign: 'center', marginTop: '40px' }}>
          <img src="/media/media_library/Ajouter-un-titre.png" alt="Nos Partenaires - JSAN 2025" className="partners-grid-img" style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }} />
          <p style={{ marginTop: '20px', fontSize: '1.1rem', color: 'var(--white)', opacity: '0.9' }}>Ils nous font confiance et accompagnent cette édition exceptionnelle des JSAN.</p>
        </div>
      ) : (
        <div className="reveal" style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {groupSponsorsByLevel(sponsors).map((group) => (
            <div key={group.level}>
              <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {group.label}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {group.items.map((sponsor) => {
                  const accent = sponsor.couleur || SPONSOR_LEVEL_COLORS[sponsor.niveau];
                  const content = (
                    <div style={{
                      background: 'rgba(255,255,255,0.96)',
                      borderRadius: '16px',
                      padding: '16px',
                      minHeight: '150px',
                      borderTop: `4px solid ${accent}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-md)',
                    }}>
                      <div>
                        {getSponsorLogoUrl(supabase, sponsor) ? (
                          <img
                            src={getSponsorLogoUrl(supabase, sponsor)!}
                            alt={sponsor.nom}
                            style={{ width: '100%', height: '70px', objectFit: 'contain', marginBottom: '12px' }}
                          />
                        ) : (
                          <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '10px', color: '#94a3b8', marginBottom: '12px' }}>
                            Logo
                          </div>
                        )}
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>{sponsor.nom}</div>
                        {sponsor.description && (
                          <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{sponsor.description}</div>
                        )}
                      </div>
                      {sponsor.website_url && (
                        <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 700, color: accent }}>
                          Visiter le site
                        </div>
                      )}
                    </div>
                  );

                  return sponsor.website_url ? (
                    <a key={sponsor.id} href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      {content}
                    </a>
                  ) : (
                    <div key={sponsor.id}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>

  {/* ===== FAQ & CONTACT ===== */}
  <section className="section section-alt" id="faq">
    <div className="container">
      <div className="faq-grid">
        {/* FAQ Column */}
        <div className="faq-column reveal">
          <h3>QUESTIONS FRÉQUEMMENT POSÉES :</h3>

          <div className="faq-item active">
            <div className="faq-question" onClick={(e) => window.toggleFaq(e.currentTarget)}>
              Qu'est-ce que les JSAN ?
              <span className="faq-chevron">▲</span>
            </div>
            <div className="faq-answer">
              <p>Les JSAN (Journées Scientifiques de l'Alimentation et de la Nutrition) sont une conférence scientifique organisée par la Société de Nutrition du Bénin (SNB). Cette première édition se concentre sur la situation nutritionnelle en Afrique face aux défis des systèmes alimentaires.</p>
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question" onClick={(e) => window.toggleFaq(e.currentTarget)}>
              Quels sont les objectifs des JSAN ?
              <span className="faq-chevron">▼</span>
            </div>
            <div className="faq-answer">
              <p>Les JSAN visent à analyser les enjeux de la sécurité alimentaire, promouvoir la recherche scientifique, renforcer les capacités des professionnels et proposer des actions concrètes pour l'atteinte des ODD en matière de nutrition.</p>
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question" onClick={(e) => window.toggleFaq(e.currentTarget)}>
              Comment s'inscrire aux JSAN 2025 ?
              <span className="faq-chevron">▼</span>
            </div>
            <div className="faq-answer">
              <p>Vous pouvez vous inscrire en ligne via notre plateforme d'inscription. Les tarifs varient selon votre statut (étudiant, chercheur, professionnel) et votre appartenance à la SNB.</p>
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question" onClick={(e) => window.toggleFaq(e.currentTarget)}>
              Où se déroulent les JSAN 2025 ?
              <span className="faq-chevron">▼</span>
            </div>
            <div className="faq-answer">
              <p>Les JSAN 2025 se déroulent au Palais des Congrès de Cotonou, Bénin, du 10 au 14 juin 2025 (présentiel et en ligne).</p>
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question" onClick={(e) => window.toggleFaq(e.currentTarget)}>
              Puis-je soumettre un article ?
              <span className="faq-chevron">▼</span>
            </div>
            <div className="faq-answer">
              <p>Oui, les participants peuvent soumettre des articles après les JSAN entre le 16 et le 24 juin 2025. Les actes seront publiés le 30 juin 2025 et un numéro spécial du Journal de la SNB sera publié le 15 septembre 2025.</p>
            </div>
          </div>
        </div>

        {/* Contact Column */}
        <div className="faq-column reveal" id="contact">
          <div className="contact-form-mini">
            <h3>VOUS AVEZ ENCORE DES QUESTIONS ?</h3>
            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <input
                  type="text"
                  name="nom"
                  id="contact-nom"
                  placeholder="Votre nom"
                  aria-label="Votre nom"
                  autoComplete="name"
                  required
                  value={contactNom}
                  onChange={(e) => setContactNom(e.target.value)}
                  disabled={contactLoading}
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  id="contact-email"
                  placeholder="Votre e-mail"
                  aria-label="Votre e-mail"
                  autoComplete="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={contactLoading}
                />
              </div>
              <div className="form-group">
                <textarea
                  name="message"
                  id="contact-message"
                  placeholder="Votre message..."
                  aria-label="Votre message..."
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  disabled={contactLoading}
                />
              </div>
              {contactNotice && (
                <p
                  role="status"
                  style={{
                    margin: '0 0 12px',
                    fontSize: '13px',
                    color: contactNotice.type === 'success' ? '#166534' : '#b91c1c',
                  }}
                >
                  {contactNotice.text}
                </p>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={contactLoading}>
                {contactLoading ? 'Envoi…' : 'Envoyer le message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>

  </div> {/* End of slider-wrapper */}

  {/* ===== FIXED BOTTOM BAR ===== */}
  <div className="global-bottom-bar">
    <div className="container bottom-bar-container">
      <span className="copyright hidden-mobile">
        © {new Date().getFullYear()} SNB · JSAN · Conçu par{' '}
        <a href="https://guelichweb.online/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
          Guelichweb
        </a>
      </span>
      <div className="newsletter-inline">
        <span className="newsletter-text hidden-mobile">S'INSCRIRE À NOTRE NEWSLETTER</span>
        <input
          type="email"
          name="newsletter-email"
          id="global-newsletter-email"
          placeholder="Votre e-mail..."
          aria-label="Votre e-mail pour la newsletter"
          autoComplete="email"
          value={newsletterEmail}
          onChange={(e) => setNewsletterEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleNewsletterSubscribe();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={newsletterLoading}
          onClick={() => void handleNewsletterSubscribe()}
          aria-label="S'inscrire à la newsletter"
        >
          {newsletterLoading ? '…' : '→'}
        </button>
      </div>
      {newsletterNotice && (
        <span
          style={{
            position: 'fixed',
            bottom: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: newsletterNotice.type === 'success' ? '#166534' : '#b91c1c',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '999px',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >
          {newsletterNotice.text}
        </span>
      )}
      <a
        href="#faq"
        className="bottom-contact-link"
        onClick={(e) => {
          e.preventDefault();
          const slides = Array.from(
            document.querySelectorAll('#slider-wrapper > section, #slider-wrapper > footer')
          );
          const idx = slides.findIndex((s) => s.id === 'faq');
          window.goToSlide?.(idx >= 0 ? idx : slides.length - 1);
        }}
      >
        Contact
      </a>
    </div>
  </div>

  {/* Slideshow Arrows */}
  <button className="slider-arrow slider-arrow-left" id="prevSlide" aria-label="Slide précédente">❮</button>
  <button className="slider-arrow slider-arrow-right" id="nextSlide" aria-label="Slide suivante">❯</button>

  
      {/* CUSTOM ALERT MODAL */}
      {customAlert.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '16px' }}>
                ⚠️
              </div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Action requise</h3>
              <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: 1.5 }}>{customAlert.message}</p>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', justifyContent: 'center', borderTop: '1px solid #f1f5f9' }}>
              <button 
                onClick={() => {
                  setCustomAlert({ show: false, message: '' });
                  if (customAlert.action) customAlert.action();
                }}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#1B6B2E', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', width: '100%', boxShadow: '0 4px 6px -1px rgba(27, 107, 46, 0.2)' }}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
