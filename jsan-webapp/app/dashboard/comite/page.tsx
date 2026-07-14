"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  COMMITTEE_SECTION_LABELS,
  fetchCommitteeMembers,
  groupCommitteeMembers,
  type CommitteeMember,
} from '@/lib/committee';
import { OFFICIAL_PUBLIC_DOCS } from '@/lib/official-docs';

export default function ComitePage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchCommitteeMembers(supabase, { activeOnly: true });
        if (!cancelled) setMembers(rows);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Impossible de charger le comité.';
          setError(
            msg.includes('committee_members') || msg.includes('does not exist') || msg.includes('relation')
              ? 'Table comité introuvable. Exécutez la migration 035 dans Supabase, puis rechargez.'
              : msg
          );
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const grouped = useMemo(() => groupCommitteeMembers(members), [members]);

  return (
    <div className="page-shell" style={{ maxWidth: '960px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0F2E18 0%, #145224 48%, #1B6B2E 100%)',
          borderRadius: '18px',
          padding: '28px',
          color: '#fff',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1B6B2E 0 34%, #F0C419 34% 66%, #D94A2A 66% 100%)',
          }}
        />
        <p style={{ margin: '0 0 6px', fontSize: '12px', opacity: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          JSAN
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 700 }}>Comité d’organisation</h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', opacity: 0.88, maxWidth: '560px', lineHeight: 1.55 }}>
          Bureau, personnes ressources et commissions techniques des Journées Scientifiques de l’Alimentation et de la Nutrition.
        </p>
        <a
          href={OFFICIAL_PUBLIC_DOCS.comiteOrganisation.path}
          download
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.14)',
            color: '#fff',
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          Télécharger le document officiel
        </a>
      </div>

      {loading && <p style={{ color: '#94a3b8' }}>Chargement du comité…</p>}

      {error && (
        <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '14px', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <div style={{ padding: '24px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>
          Aucun membre publié pour le moment. Les organisateurs peuvent les ajouter dans Paramètres.
        </div>
      )}

      {!loading && members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <SectionCard title={COMMITTEE_SECTION_LABELS.bureau} members={grouped.bureau} />
          <SectionCard title={COMMITTEE_SECTION_LABELS.ressource} members={grouped.ressources} />
          {grouped.commissions.map((c) => (
            <SectionCard key={c.name} title={`Commission — ${c.name}`} members={c.members} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, members }: { title: string; members: CommitteeMember[] }) {
  if (members.length === 0) return null;
  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{title}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0' }}>
        {members.map((m) => (
          <div key={m.id} style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#1B6B2E', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>
              {m.title}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
              {m.full_name}
            </div>
            {m.is_messaging_contact && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>Contact secrétariat</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
