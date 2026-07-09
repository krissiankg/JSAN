"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchMyAttestations, type UserAttestation } from '@/lib/attestations';
import AttestationPreviewSheet from '@/components/dashboard/AttestationPreviewSheet';

export default function AttestationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [attestation, setAttestation] = useState<UserAttestation | null>(null);
  const [loading, setLoading] = useState(true);
  const [attestationId, setAttestationId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setAttestationId(p.id));
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!user || !attestationId) return;
      setLoading(true);
      const rows = await fetchMyAttestations(supabase, user.id);
      setAttestation(rows.find((row) => row.id === attestationId) ?? null);
      setLoading(false);
    }
    void load();
  }, [user, attestationId, supabase]);

  if (loading) return <div style={{ padding: '40px', color: '#94a3b8' }}>Chargement…</div>;
  if (!attestation) {
    return (
      <div style={{ padding: '40px' }}>
        <p style={{ color: '#b91c1c' }}>Attestation introuvable ou non disponible.</p>
        <Link href="/dashboard/attestations">← Retour</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 60px', background: '#f1f5f9', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .attestation-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: '980px', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/dashboard/attestations" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>← Retour aux attestations</Link>
        <button type="button" onClick={() => window.print()} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>
          Télécharger / Imprimer en PDF
        </button>
      </div>

      <AttestationPreviewSheet attestation={attestation} />
    </div>
  );
}
