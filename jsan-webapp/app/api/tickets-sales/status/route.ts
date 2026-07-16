import { NextResponse } from 'next/server';

import { fetchTicketsSalesStatusFromApi } from '@/lib/ticket-sales';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await fetchTicketsSalesStatusFromApi();
  return NextResponse.json(status);
}
