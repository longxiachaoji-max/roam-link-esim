import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin, requirePhysicalStoreAdmin } from '@/lib/physical-store';

export const dynamic = 'force-dynamic';

const ORDER_STATUSES = new Set(['PENDING_PAYMENT', 'PROCESSING', 'STOCK_ISSUE', 'SHIPPED', 'COMPLETED', 'CANCELLED']);

export async function GET(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_orders')
      .select('*, physical_order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取訂單失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const body = await request.json();
    const id = String(body.id || '');
    const orderStatus = String(body.order_status || '');
    if (!id || !ORDER_STATUSES.has(orderStatus)) {
      return NextResponse.json({ error: '訂單狀態不正確' }, { status: 400 });
    }
    const { error } = await getPhysicalStoreAdmin()
      .from('physical_orders')
      .update({ order_status: orderStatus })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新訂單失敗' }, { status: 500 });
  }
}
