import Link from 'next/link';
import MaintenanceIllustration from '@/components/MaintenanceIllustration';
import { DEFAULT_MAINTENANCE_MESSAGE, fetchMaintenanceStatusFromApi } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const status = await fetchMaintenanceStatusFromApi();
  const message = status.message || DEFAULT_MAINTENANCE_MESSAGE;

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
        <MaintenanceIllustration />

        <p
          style={{
            margin: '8px 0 18px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          Maintenance
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
          Site en maintenance
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
              background: '#f59e0b',
              boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.18)',
            }}
          />
          Mise à jour en cours
        </div>

        <p style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
          Équipe organisatrice ?{' '}
          <Link href="/login" style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
            Connexion staff
          </Link>
        </p>
      </div>
    </div>
  );
}
