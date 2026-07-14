"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { fetchAgendaSessions, formatTimeRange, type AgendaSession } from '@/lib/agenda';
import {
  fetchEventRooms,
  findParallelSlots,
  resolveSessionVisioUrl,
  resolveSessionVisioProvider,
  visioProviderIcon,
  VISIO_PROVIDER_LABELS,
  ROOM_TYPE_LABELS,
  type EventRoom,
} from '@/lib/rooms';

const VISIO_TOOLS = [
  {
    name: 'Zoom',
    icon: '📹',
    accent: '#1B6B2E',
    bg: '#E8F5EC',
    border: '#B7DFC0',
    blurb: 'Standard des congrès. Un meeting = un lien. Pour les parallèles : un meeting par salle.',
  },
  {
    name: 'Google Meet',
    icon: '🟢',
    accent: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    blurb: 'Idéal avec Google Workspace. Même règle : un lien distinct par salle parallèle.',
  },
  {
    name: 'Microsoft Teams',
    icon: '🟦',
    accent: '#4f46e5',
    bg: '#eef2ff',
    border: '#c7d2fe',
    blurb: 'Adapté aux institutions sur Microsoft 365. Réunions ou canaux par salle.',
  },
  {
    name: 'Jitsi',
    icon: '🎥',
    accent: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    blurb: 'Open source et gratuit (meet.jit.si ou auto-hébergé). Bon rapport coût / simplicité.',
  },
] as const;

export default function AdminVisioconferences() {
  const { userRole } = useAuth();
  const supabase = createClient();
  const [rooms, setRooms] = useState<EventRoom[]>([]);
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([fetchEventRooms(supabase), fetchAgendaSessions(supabase)]);
    setRooms(r);
    setSessions(s);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) load();
  }, [userRole, load]);

  const virtualRooms = useMemo(() => rooms.filter((r) => r.type === 'virtuelle' || r.type === 'hybride'), [rooms]);
  const roomsWithLink = useMemo(() => virtualRooms.filter((r) => Boolean(r.visio_url)), [virtualRooms]);
  const parallelSlots = useMemo(() => findParallelSlots(sessions), [sessions]);
  const sessionsWithVisio = useMemo(
    () => sessions.filter((s) => resolveSessionVisioUrl(s)),
    [sessions]
  );
  const sessionsMissingVisio = useMemo(
    () => sessions.filter((s) => {
      const room = rooms.find((r) => r.id === s.room_id);
      const needsVisio = room?.type === 'virtuelle' || room?.type === 'hybride' || s.type_session?.toLowerCase().includes('virtuel');
      return needsVisio && !resolveSessionVisioUrl({ ...s, room: room ?? s.room ?? null });
    }),
    [sessions, rooms]
  );

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès Interdit</h2>
      </div>
    );
  }

  const stats = [
    { label: 'Salles virtuelles', value: virtualRooms.length, hint: `${roomsWithLink.length} avec lien` },
    { label: 'Liens session', value: sessionsWithVisio.length, hint: 'dans le programme' },
    { label: 'Créneaux parallèles', value: parallelSlots.length, hint: parallelSlots.length ? 'à vérifier' : 'aucun' },
    {
      label: 'Sans lien',
      value: sessionsMissingVisio.length,
      hint: sessionsMissingVisio.length ? 'à compléter' : 'tout est prêt',
      alert: sessionsMissingVisio.length > 0,
    },
  ];

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px' }}>Visioconférences &amp; Streaming</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6, maxWidth: '560px' }}>
            Associez un outil externe (Zoom, Meet, Teams, Jitsi) à vos salles et sessions. JSAN affiche les liens dans le programme.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            href="/dashboard/admin/salles"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#0f172a',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Configurer les salles
          </Link>
          <Link
            href="/dashboard/admin/programme"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#fff',
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid #e2e8f0',
            }}
          >
            Ouvrir le programme
          </Link>
        </div>
      </div>

      {/* Parcours rapide */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {[
          { step: '1', title: 'Créer les salles', text: 'Virtuelles ou hybrides dans Salles' },
          { step: '2', title: 'Coller les liens', text: 'URL Zoom / Meet / Teams / Jitsi' },
          { step: '3', title: 'Placer les sessions', text: 'Chaque parallèle = une salle' },
        ].map((item) => (
          <div
            key={item.step}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.step}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Outils */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Outils recommandés</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
          Choisissez l&apos;outil de votre institution, puis collez le lien dans chaque salle.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {VISIO_TOOLS.map((tool) => (
            <div
              key={tool.name}
              style={{
                padding: '16px',
                background: tool.bg,
                borderRadius: '12px',
                border: `1px solid ${tool.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>{tool.icon}</span>
                <strong style={{ fontSize: '14px', color: tool.accent }}>{tool.name}</strong>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>{tool.blurb}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.alert ? '#fef2f2' : '#fff',
                  border: `1px solid ${s.alert ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: s.alert ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '12px', color: s.alert ? '#dc2626' : '#94a3b8', marginTop: '6px' }}>{s.hint}</div>
              </div>
            ))}
          </div>

          {sessionsMissingVisio.length > 0 && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '12px',
                padding: '14px 18px',
                fontSize: '14px',
                color: '#b91c1c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>{sessionsMissingVisio.length} session(s)</strong> virtuelle(s) sans lien visio.
              </span>
              <Link href="/dashboard/admin/programme" style={{ color: '#1B6B2E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Compléter dans le programme →
              </Link>
            </div>
          )}

          {/* Salles virtuelles */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Salles virtuelles / hybrides</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {virtualRooms.length === 0
                    ? 'Créez au moins une salle pour y coller un lien visio.'
                    : `${roomsWithLink.length} / ${virtualRooms.length} salle(s) avec lien configuré.`}
                </p>
              </div>
              <Link href="/dashboard/admin/salles" style={{ fontSize: '13px', color: '#1B6B2E', fontWeight: 600 }}>
                Gérer les salles →
              </Link>
            </div>
            {virtualRooms.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 12px' }}>
                  Aucune salle virtuelle pour l&apos;instant.
                </p>
                <Link
                  href="/dashboard/admin/salles"
                  style={{
                    display: 'inline-flex',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    background: '#1B6B2E',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Créer une salle
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {virtualRooms.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #eef2f7',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px' }}>{r.nom}</strong>
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          color: '#475569',
                          background: '#e2e8f0',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {ROOM_TYPE_LABELS[r.type]}
                      </span>
                      {r.visio_provider && (
                        <span style={{ marginLeft: '6px', fontSize: '12px', color: '#64748b' }}>
                          {visioProviderIcon(r.visio_provider)} {VISIO_PROVIDER_LABELS[r.visio_provider]}
                        </span>
                      )}
                    </div>
                    {r.visio_url ? (
                      <a
                        href={r.visio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', fontWeight: 600, color: '#1B6B2E' }}
                      >
                        Ouvrir le lien →
                      </a>
                    ) : (
                      <Link href="/dashboard/admin/salles" style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
                        Ajouter un lien →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Créneaux parallèles */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 6px' }}>Sessions parallèles</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Quand plusieurs sessions se chevauchent, chacune doit être dans une <strong>salle différente</strong> avec son propre lien.
            </p>
            {parallelSlots.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              >
                Aucun créneau parallèle détecté pour l&apos;instant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {parallelSlots.map((slot, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#f1f5f9',
                        padding: '10px 14px',
                        fontWeight: 600,
                        fontSize: '13px',
                        textTransform: 'capitalize',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{slot.dateLabel}</span>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>{slot.sessions.length} sessions en parallèle</span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1px',
                        background: '#e2e8f0',
                      }}
                    >
                      {slot.sessions.map((s) => {
                        const visio = resolveSessionVisioUrl(s);
                        const provider = resolveSessionVisioProvider(s);
                        return (
                          <div key={s.id} style={{ background: '#fff', padding: '14px 16px' }}>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{formatTimeRange(s.heure_debut, s.heure_fin)}</div>
                            <div style={{ fontWeight: 600, fontSize: '14px', margin: '4px 0 6px' }}>{s.titre}</div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                              📍 {s.salle_nom || s.room?.nom || '—'}
                            </div>
                            {visio ? (
                              <a
                                href={visio}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', fontWeight: 600, color: '#1B6B2E' }}
                              >
                                {visioProviderIcon(provider)} {provider ? VISIO_PROVIDER_LABELS[provider] : 'Visio'}
                              </a>
                            ) : (
                              <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
                                Pas de lien
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Toutes les sessions avec visio */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>Tous les liens visio</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>{sessionsWithVisio.length} session(s)</span>
            </div>
            {sessionsWithVisio.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              >
                Aucun lien configuré. Ajoutez-les via les salles ou le programme.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '10px' }}>Session</th>
                      <th style={{ padding: '10px' }}>Date</th>
                      <th style={{ padding: '10px' }}>Salle</th>
                      <th style={{ padding: '10px' }}>Visio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsWithVisio.map((s) => {
                      const visio = resolveSessionVisioUrl(s)!;
                      const provider = resolveSessionVisioProvider(s);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 500 }}>{s.titre}</td>
                          <td style={{ padding: '12px 10px', color: '#64748b' }}>{s.date_session ?? '—'}</td>
                          <td style={{ padding: '12px 10px' }}>{s.salle_nom || s.room?.nom || '—'}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <a href={visio} target="_blank" rel="noopener noreferrer" style={{ color: '#1B6B2E', fontWeight: 600 }}>
                              {visioProviderIcon(provider)} {provider ? VISIO_PROVIDER_LABELS[provider] : 'Lien'}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
