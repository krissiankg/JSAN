import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  DEFAULT_REGISTRATIONS_CLOSED_MESSAGE,
  fetchRegistrationsStatusFromApi,
} from '@/lib/registrations';

export const dynamic = 'force-dynamic';

export default async function RegistrationsClosedPage() {
  const status = await fetchRegistrationsStatusFromApi();
  if (status.open) {
    redirect('/register');
  }
  const message = status.message || DEFAULT_REGISTRATIONS_CLOSED_MESSAGE;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
          }}
          aria-hidden
        >
          🎟️
        </div>

        <p
          style={{
            margin: '0 0 18px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          Inscriptions
        </p>

        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 'clamp(1.6rem, 4vw, 2rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          Inscriptions closes
        </h1>

        <p
          style={{
            margin: '0 auto 28px',
            maxWidth: '420px',
            fontSize: '15px',
            lineHeight: 1.7,
            color: '#64748b',
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '999px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
            color: '#475569',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#64748b',
              boxShadow: '0 0 0 4px rgba(100, 116, 139, 0.15)',
            }}
          />
          Nouveaux comptes temporairement indisponibles
        </div>

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
          <p style={{ margin: 0, color: '#64748b' }}>
            Déjà inscrit ?{' '}
            <Link href="/login" style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
              Se connecter
            </Link>
          </p>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
            <Link href="/" style={{ color: '#475569', textDecoration: 'underline' }}>
              Retour au site JSAN
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
