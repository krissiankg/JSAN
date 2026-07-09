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

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px' }}>Visioconférences &amp; Streaming</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
          Vue d&apos;ensemble des liens visio et des créneaux parallèles.
        </p>
      </div>

      {/* Guide choix outil */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 12px' }}>Quel outil choisir ?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
            <strong>📹 Zoom</strong>
            <p style={{ margin: '6px 0 0' }}>Le plus courant pour les congrès. Un meeting = un lien. Pour les sessions parallèles, créez <em>un meeting par salle</em> (ou réunions récurrentes avec ID différent).</p>
          </div>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
            <strong>🟢 Google Meet</strong>
            <p style={{ margin: '6px 0 0' }}>Simple si l&apos;équipe utilise Google Workspace. Même principe : un lien par salle parallèle.</p>
          </div>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
            <strong>🟦 Microsoft Teams</strong>
            <p style={{ margin: '6px 0 0' }}>Adapté si l&apos;institution est sur Microsoft 365.</p>
          </div>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
            <strong>🎥 Jitsi</strong>
            <p style={{ margin: '6px 0 0' }}>Open source, gratuit (meet.jit.si ou auto-hébergé). Bon pour réduire les coûts, moins de fonctions modération qu&apos;Zoom.</p>
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#b45309', background: '#fffbeb', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fde68a' }}>
          <strong>Construire notre propre visio ?</strong> Non recommandé — il faudrait WebRTC, serveurs TURN, enregistrement, modération… des mois de développement.
          L&apos;app JSAN gère le <strong>programme + les liens</strong> ; l&apos;outil visio reste externe.
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : (
        <>
          {/* Alertes */}
          {sessionsMissingVisio.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px 18px', fontSize: '14px', color: '#b91c1c' }}>
              <strong>{sessionsMissingVisio.length} session(s)</strong> virtuelle(s) sans lien visio.
              <Link href="/dashboard/admin/programme" style={{ marginLeft: '8px', color: '#2563eb', fontWeight: 600 }}>Compléter dans le programme →</Link>
            </div>
          )}

          {/* Salles virtuelles */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>Salles virtuelles / hybrides ({virtualRooms.length})</h2>
              <Link href="/dashboard/admin/salles" style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>Gérer les salles →</Link>
            </div>
            {virtualRooms.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Aucune salle virtuelle. Créez-en dans Salles (ex. « Salle virtuelle A », « Salle virtuelle B »).</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {virtualRooms.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong>{r.nom}</strong>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>{ROOM_TYPE_LABELS[r.type]}</span>
                    </div>
                    {r.visio_url ? (
                      <a href={r.visio_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
                        {visioProviderIcon(r.visio_provider)} Ouvrir le lien
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#f59e0b' }}>Lien à configurer</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Créneaux parallèles */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 6px' }}>Sessions parallèles (même créneau)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Quand plusieurs sessions se chevauchent, chacune doit être dans une <strong>salle différente</strong> avec son propre lien.
            </p>
            {parallelSlots.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Aucun créneau parallèle détecté pour l&apos;instant.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {parallelSlots.map((slot, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ background: '#f1f5f9', padding: '10px 14px', fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>
                      {slot.dateLabel} — {slot.sessions.length} sessions en parallèle
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', background: '#e2e8f0' }}>
                      {slot.sessions.map((s) => {
                        const visio = resolveSessionVisioUrl(s);
                        const provider = resolveSessionVisioProvider(s);
                        return (
                          <div key={s.id} style={{ background: '#fff', padding: '12px 14px' }}>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{formatTimeRange(s.heure_debut, s.heure_fin)}</div>
                            <div style={{ fontWeight: 600, fontSize: '14px', margin: '4px 0' }}>{s.titre}</div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>📍 {s.salle_nom || s.room?.nom || '—'}</div>
                            {visio ? (
                              <a href={visio} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>
                                {visioProviderIcon(provider)} {provider ? VISIO_PROVIDER_LABELS[provider] : 'Visio'}
                              </a>
                            ) : (
                              <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', color: '#f59e0b' }}>Pas de lien</span>
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
            <h2 style={{ fontSize: '16px', margin: '0 0 16px' }}>Tous les liens visio ({sessionsWithVisio.length})</h2>
            {sessionsWithVisio.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Aucun lien configuré.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
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
                          <td style={{ padding: '10px', fontWeight: 500 }}>{s.titre}</td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{s.date_session ?? '—'}</td>
                          <td style={{ padding: '10px' }}>{s.salle_nom || s.room?.nom || '—'}</td>
                          <td style={{ padding: '10px' }}>
                            <a href={visio} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                              {visioProviderIcon(provider)} Lien
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
