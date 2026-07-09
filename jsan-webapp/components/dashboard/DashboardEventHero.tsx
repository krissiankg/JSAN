"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatEventDates } from '@/lib/tickets';

/** URL du PDF programme — à remplacer quand le fichier est disponible */
export const PROGRAMME_DOWNLOAD_URL = '/media/media_library/programme-jsan-2025.pdf';

const DEFAULT_THEME =
  "Situation nutritionnelle en Afrique face aux défis des systèmes alimentaires : quel horizon d'ici 2030 ?";

interface DashboardEventHeroProps {
  spaceLabel?: string;
  displayName?: string;
  welcomeSubtitle?: string;
  accentColor?: string;
}

export default function DashboardEventHero({
  spaceLabel,
  displayName,
  welcomeSubtitle,
  accentColor = '#2563eb',
}: DashboardEventHeroProps) {
  const supabase = createClient();
  const [eventName, setEventName] = useState("Journées Scientifiques de l'Alimentation et de la Nutrition");
  const [dateDebut, setDateDebut] = useState('2025-06-10');
  const [dateFin, setDateFin] = useState('2025-06-14');

  const showWelcome = Boolean(spaceLabel && displayName);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events_config')
        .select('nom_evenement, date_debut, date_fin')
        .limit(1)
        .maybeSingle();
      if (data?.nom_evenement) setEventName(data.nom_evenement);
      if (data?.date_debut) setDateDebut(data.date_debut);
      if (data?.date_fin) setDateFin(data.date_fin);
    }
    load();
  }, [supabase]);

  return (
    <div
      className="dashboard-event-hero"
      style={{ '--hero-accent': accentColor } as React.CSSProperties}
    >
      <div className="dashboard-event-hero__top">
        <div className="dashboard-event-hero__badges">
          <span className="dashboard-event-hero__badge dashboard-event-hero__badge--primary">JSAN 2025</span>
          <span className="dashboard-event-hero__badge">1ère Édition</span>
        </div>
        <div className="dashboard-event-hero__meta">
          <div>📅 {formatEventDates(dateDebut, dateFin)}</div>
          <div>📍 Palais des Congrès, Cotonou</div>
        </div>
      </div>

      {showWelcome && (
        <div className="dashboard-event-hero__welcome">
          <h2 className="dashboard-event-hero__greeting">
            Bienvenue, {displayName} 👋
          </h2>
          <p className="dashboard-event-hero__space" style={{ borderLeftColor: accentColor }}>
            {spaceLabel}
          </p>
        </div>
      )}

      <h1 className="dashboard-event-hero__title">{eventName}</h1>
      <p className="dashboard-event-hero__theme">Thème : {DEFAULT_THEME}</p>

      {showWelcome && welcomeSubtitle && (
        <div className="dashboard-event-hero__subtitle-wrap">
          <p className="dashboard-event-hero__subtitle">{welcomeSubtitle}</p>
        </div>
      )}

      <a href={PROGRAMME_DOWNLOAD_URL} download className="dashboard-event-hero__download">
        <span>📥</span> Télécharger le programme
      </a>
    </div>
  );
}
