"use client";

import React from 'react';
import { formatAttestationDate, type UserAttestation } from '@/lib/attestations';

type PreviewAttestation = Pick<
  UserAttestation,
  | 'titre'
  | 'designation'
  | 'intro_text'
  | 'recipient_label'
  | 'recipient_name'
  | 'body_text'
  | 'footer_text'
  | 'reference_code'
  | 'issued_on'
  | 'signatory_left_name'
  | 'signatory_left_title'
  | 'signatory_right_name'
  | 'signatory_right_title'
>;

export default function AttestationPreviewSheet({
  attestation,
  compact = false,
}: {
  attestation: PreviewAttestation;
  compact?: boolean;
}) {
  return (
    <div
      className="attestation-sheet"
      style={{
        maxWidth: compact ? '860px' : '980px',
        margin: '0 auto',
        background: '#fffdf8',
        borderRadius: compact ? '14px' : '18px',
        padding: compact ? '32px 36px 28px' : '42px 56px 36px',
        boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
        border: '1px solid #e5e7eb',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: compact ? '14px' : '18px', border: '2px solid #d4a017', borderRadius: compact ? '12px' : '14px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: compact ? '26px' : '32px', border: '1px solid #e9c96a', borderRadius: '10px', pointerEvents: 'none' }} />

      <div style={{ textAlign: 'center', marginBottom: compact ? '24px' : '34px' }}>
        <div style={{ fontSize: compact ? '15px' : '18px', letterSpacing: '0.28em', fontWeight: 800, color: '#8b6b10' }}>
          {attestation.titre.toUpperCase()}
        </div>
        {attestation.designation && (
          <div style={{ fontSize: compact ? '30px' : '42px', fontWeight: 800, color: '#c58c00', lineHeight: 1.05, marginTop: '12px' }}>
            {attestation.designation}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? '20px' : '28px', alignItems: 'start', marginBottom: compact ? '18px' : '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: compact ? '20px' : '24px', fontWeight: 700, color: '#0f172a' }}>{attestation.signatory_left_name}</div>
          <div style={{ fontSize: compact ? '14px' : '17px', color: '#475569', lineHeight: 1.35, whiteSpace: 'pre-line', marginTop: '8px' }}>{attestation.signatory_left_title}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: compact ? '16px' : '18px', fontWeight: 700, color: '#7c3aed' }}>1ère édition</div>
        </div>
      </div>

      <div style={{ margin: '22px auto 0', maxWidth: compact ? '680px' : '760px', textAlign: 'center' }}>
        <p style={{ fontSize: compact ? '18px' : '24px', color: '#475569', margin: '0 0 16px' }}>{attestation.intro_text}</p>
        <div style={{ fontSize: compact ? '30px' : '38px', fontWeight: 800, color: '#0f172a', marginBottom: '18px', lineHeight: 1.1 }}>
          {(attestation.recipient_label ? `${attestation.recipient_label} ` : '') + attestation.recipient_name}
        </div>
        <p style={{ fontSize: compact ? '17px' : '22px', lineHeight: 1.7, color: '#374151', margin: 0 }}>
          {attestation.body_text}
        </p>
        {attestation.footer_text && (
          <p style={{ fontSize: compact ? '17px' : '22px', lineHeight: 1.6, color: '#374151', marginTop: '18px' }}>
            {attestation.footer_text}
          </p>
        )}
      </div>

      <div style={{ marginTop: compact ? '26px' : '34px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: compact ? '14px' : '16px', color: '#374151', fontWeight: 600 }}>
          {attestation.reference_code && <div>Réf {attestation.reference_code}</div>}
          {attestation.issued_on && <div style={{ marginTop: '8px' }}>Émise le {formatAttestationDate(attestation.issued_on)}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? '20px' : '28px', flex: 1, minWidth: compact ? '320px' : '420px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: compact ? '40px' : '56px' }} />
            <div style={{ fontSize: compact ? '18px' : '22px', fontWeight: 700, color: '#0f172a' }}>{attestation.signatory_left_name}</div>
            <div style={{ fontSize: compact ? '14px' : '16px', color: '#475569', whiteSpace: 'pre-line', marginTop: '6px', lineHeight: 1.35 }}>{attestation.signatory_left_title}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: compact ? '40px' : '56px' }} />
            <div style={{ fontSize: compact ? '18px' : '22px', fontWeight: 700, color: '#0f172a' }}>{attestation.signatory_right_name}</div>
            <div style={{ fontSize: compact ? '14px' : '16px', color: '#475569', whiteSpace: 'pre-line', marginTop: '6px', lineHeight: 1.35 }}>{attestation.signatory_right_title}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
