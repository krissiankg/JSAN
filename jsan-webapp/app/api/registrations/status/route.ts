import { NextResponse } from 'next/server';

import { fetchRegistrationsStatusFromApi } from '@/lib/registrations';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await fetchRegistrationsStatusFromApi();
  return NextResponse.json(status);
}
