import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';
import { sendDuePhysicalRentalReminders } from '@/lib/physical-rental-alerts';
import { expirePendingBarcodeOrders } from '@/lib/barcode-order-expiry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getPhysicalStoreAdmin();
    const [result, barcodeExpiry] = await Promise.all([
      sendDuePhysicalRentalReminders(supabase),
      expirePendingBarcodeOrders(supabase)
    ]);
    return NextResponse.json({ ok: true, ...result, ...barcodeExpiry }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    });
  } catch (error) {
    console.error('Scheduled maintenance failed:', error);
    return NextResponse.json({ error: 'Scheduled maintenance failed' }, { status: 500 });
  }
}
