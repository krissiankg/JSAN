import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import {
  canBypassMaintenance,
  fetchMaintenanceStatusFromApi,
} from '@/lib/maintenance';
import { fetchRegistrationsStatusFromApi } from '@/lib/registrations';
import type { DbUserRole } from '@/lib/roles';

const MAINTENANCE_EXEMPT_PREFIXES = [
  '/maintenance',
  '/inscriptions-fermees',
  '/blog',
  '/_next',
  '/media/',
  '/favicon.ico',
];

const MAINTENANCE_EXEMPT_EXACT = new Set(['/login']);

const MAINTENANCE_WEBHOOK_PREFIXES = ['/api/kkiapay/webhook'];
const MAINTENANCE_API_EXEMPT = ['/api/registrations/status', '/api/newsletter/subscribe'];

function isMaintenanceExemptPath(pathname: string): boolean {
  if (MAINTENANCE_EXEMPT_EXACT.has(pathname)) return true;
  if (MAINTENANCE_API_EXEMPT.some((path) => pathname === path)) return true;
  if (MAINTENANCE_WEBHOOK_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const maintenance = await fetchMaintenanceStatusFromApi();

  if (maintenance.enabled && !isMaintenanceExemptPath(pathname)) {
    let staffBypass = false;

    if (user) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      staffBypass = canBypassMaintenance(profile?.role as DbUserRole | undefined);
    }

    if (!staffBypass) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, message: 'Site en maintenance.' },
          { status: 503 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = '/maintenance';
      url.search = '';
      return NextResponse.rewrite(url);
    }
  }

  const isDashboard = pathname.startsWith('/dashboard');
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (!user && isDashboard) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/register')) {
    const registrations = await fetchRegistrationsStatusFromApi();
    if (!registrations.open) {
      const url = request.nextUrl.clone();
      url.pathname = '/inscriptions-fermees';
      url.search = '';
      return NextResponse.rewrite(url);
    }
  }

  return supabaseResponse;
}
