import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';
import { sendDuePhysicalRentalReminders } from '@/lib/physical-rental-alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDuePhysicalRentalReminders(getPhysicalStoreAdmin());
    return NextResponse.json({ ok: true, ...result }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    });
  } catch (error) {
    console.error('Rental reminder cron failed:', error);
    return NextResponse.json({ error: 'Rental reminder failed' }, { status: 500 });
  }
}
