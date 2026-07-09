"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchAttestationSettings, fetchMyAttestations, formatAttestationDate, type UserAttestation } from '@/lib/attestations';

export default function AttestationsPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attestations, setAttestations] = useState<UserAttestation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      const settings = await fetchAttestationSettings(supabase);
      setSettingsOpen(settings?.attestations_enabled ?? false);
      if (settings?.attestations_enabled) {
        setAttestations(await fetchMyAttestations(supabase, user.id));
      } else {
        setAttestations([]);
      }
      setLoading(false);
    }
    void load();
  }, [user, supabase]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', paddingBottom: '50px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Mes attestations</h1>
      <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px' }}>
        Téléchargez ou imprimez vos attestations lorsque l'équipe JSAN ouvre la période de mise à disposition.
      </p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Chargement…</p>
      ) : !settingsOpen ? (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '18px 20px', color: '#92400e' }}>
          Les attestations ne sont pas encore disponibles au téléchargement. Revenez plus tard.
        </div>
      ) : attestations.length === 0 ? (
        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#64748b' }}>
          Aucune attestation n&apos;a encore été créée pour votre compte.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {attestations.map((att) => (
            <div key={att.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{att.titre}{att.designation ? ` — ${att.designation}` : ''}</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{att.recipient_name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {att.reference_code ? `${att.reference_code} · ` : ''}{formatAttestationDate(att.issued_on)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link href={`/dashboard/attestations/${att.id}`} style={{ background: '#0f172a', color: '#fff', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>
                  Ouvrir l&apos;attestation
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
