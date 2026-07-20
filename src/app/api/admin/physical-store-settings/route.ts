import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin, requirePhysicalStoreAdmin } from '@/lib/physical-store';
import { normalizePhysicalStoreSettings } from '@/lib/physical-store-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_store_settings')
      .select('*')
      .eq('id', 'main')
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: normalizePhysicalStoreSettings(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取商城設定失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const settings = normalizePhysicalStoreSettings(await request.json());
    if (!settings.pickup_label) throw new Error('請輸入面交名稱或地點');
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_store_settings')
      .update(settings)
      .eq('id', 'main')
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: normalizePhysicalStoreSettings(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '儲存商城設定失敗' }, { status: 400 });
  }
}
