"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type AgendaSession,
  type AcceptedAbstract,
  fetchAgendaSessions,
  fetchAcceptedAbstracts,
  groupSessionsByDay,
  formatTimeRange,
} from '@/lib/agenda';
import {
  resolveSessionVisioUrl,
  resolveSessionVisioProvider,
  visioProviderIcon,
  VISIO_PROVIDER_LABELS,
} from '@/lib/rooms';

export default function ProgrammePage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [abstracts, setAbstracts] = useState<AcceptedAbstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const [s, a] = await Promise.all([
        fetchAgendaSessions(supabase),
        fetchAcceptedAbstracts(supabase).catch(() => [] as AcceptedAbstract[]),
      ]);
      setSessions(s);
      setAbstracts(a);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const days = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const abstractsById = useMemo(() => new Map(abstracts.map((a) => [a.id, a])), [abstracts]);
  const visibleDays = activeDay === 'all' ? days : days.filter((d) => (d.date ?? 'none') === activeDay);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Chargement du programme…</div>;
  }

  if (sessions.length === 0) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '56px', marginBottom: '14px' }}>📅</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Programme à venir</h1>
        <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
          Le programme détaillé de l&apos;événement n&apos;est pas encore publié. Revenez bientôt !
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', paddingBottom: '50px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Programme de l&apos;événement</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Retrouvez toutes les sessions, conférences et ateliers.</p>
      </div>

      {/* Filtre par jour */}
      {days.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <DayChip label="Tout" active={activeDay === 'all'} onClick={() => setActiveDay('all')} />
          {days.map((d) => (
            <DayChip
              key={d.date ?? 'none'}
              label={shortDay(d.date, d.label)}
              active={activeDay === (d.date ?? 'none')}
              onClick={() => setActiveDay(d.date ?? 'none')}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {visibleDays.map((day) => (
          <div key={day.date ?? 'none'}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#0f172a', color: '#fff', borderRadius: '8px', padding: '4px 12px', fontSize: '13px' }}>{day.label}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '4px' }}>
              {day.sessions.map((s) => (
                <PublicSessionCard key={s.id} session={s} abstractsById={abstractsById} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        border: '1px solid ' + (active ? '#0f172a' : '#e2e8f0'),
        background: active ? '#0f172a' : '#fff',
        color: active ? '#fff' : '#475569',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  );
}

function PublicSessionCard({ session, abstractsById }: { session: AgendaSession; abstractsById: Map<string, AcceptedAbstract> }) {
  const accent = session.couleur || '#2563eb';
  const linkedIds = session.abstracts_inclus ?? [];
  const linkedTitles = linkedIds.map((id) => abstractsById.get(id)?.titre).filter((t): t is string => !!t);

  return (
    <div style={{ display: 'flex', gap: '14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width: '6px', background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '16px 18px 16px 4px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: accent }}>{formatTimeRange(session.heure_debut, session.heure_fin)}</span>
          {session.type_session && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '3px 10px', borderRadius: '12px' }}>{session.type_session}</span>
          )}
          {session.salle_nom && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>📍 {session.salle_nom}</span>
          )}
        </div>

        <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>{session.titre}</h3>

        {session.intervenants && (
          <p style={{ fontSize: '13px', color: '#334155', margin: '2px 0', fontWeight: 500 }}>👤 {session.intervenants}</p>
        )}
        {session.description && (
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0', lineHeight: 1.55 }}>{session.description}</p>
        )}

        {linkedTitles.length > 0 ? (
          <div style={{ marginTop: '10px', background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>Présentations</div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {linkedTitles.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        ) : linkedIds.length > 0 ? (
          <p style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 600, margin: '10px 0 0' }}>
            📄 {linkedIds.length} présentation{linkedIds.length > 1 ? 's' : ''} au programme
          </p>
        ) : null}

        {resolveSessionVisioUrl(session) && (
          <a
            href={resolveSessionVisioUrl(session)!}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: accent, color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            {(() => {
              const p = resolveSessionVisioProvider(session);
              return <>{visioProviderIcon(p)} Rejoindre — {p ? VISIO_PROVIDER_LABELS[p] : 'en ligne'}</>;
            })()}
          </a>
        )}
      </div>
    </div>
  );
}

function shortDay(date: string | null, fallback: string): string {
  if (!date) return 'À planifier';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
