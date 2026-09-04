import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin, requirePhysicalStoreAdmin } from '@/lib/physical-store';

export const dynamic = 'force-dynamic';

const ORDER_STATUSES = new Set(['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'PROCESSING', 'STOCK_ISSUE', 'SHIPPED', 'COMPLETED', 'CANCELLED']);

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
    if (body.action === 'confirm_pickup_reservation') {
      if (!id) return NextResponse.json({ error: '訂單編號不正確' }, { status: 400 });
      const { data: status, error } = await getPhysicalStoreAdmin().rpc('confirm_physical_pickup_reservation', { p_order_id: id });
      if (error) throw error;
      if (status !== 'PROCESSING') return NextResponse.json({ error: status || '無法確認面交訂單' }, { status: 400 });
      return NextResponse.json({ success: true, orderStatus: status });
    }
    if (body.action === 'confirm_cash_payment') {
      if (!id) return NextResponse.json({ error: '訂單編號不正確' }, { status: 400 });
      const supabase = getPhysicalStoreAdmin();
      const { data: order, error: orderError } = await supabase.from('physical_orders')
        .select('id, payment_method, payment_status, order_status, total_amount').eq('id', id).maybeSingle();
      if (orderError) throw orderError;
      if (!order || order.payment_method !== 'CASH_PICKUP' || order.payment_status !== 'PENDING' || order.order_status === 'PENDING_CONFIRMATION') {
        return NextResponse.json({ error: '此訂單不是待收款的面交訂單' }, { status: 400 });
      }
      const { data: status, error } = await supabase.rpc('mark_physical_order_paid', {
        p_order_id: id,
        p_paid_amount: Number(order.total_amount)
      });
      if (error) throw error;
      return NextResponse.json({ success: true, orderStatus: status });
    }
    const orderStatus = String(body.order_status || '');
    if (!id || !ORDER_STATUSES.has(orderStatus)) {
      return NextResponse.json({ error: '訂單狀態不正確' }, { status: 400 });
    }
    const supabase = getPhysicalStoreAdmin();
    const { data: existing, error: existingError } = await supabase.from('physical_orders')
      .select('payment_method, order_status').eq('id', id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: '找不到訂單' }, { status: 404 });
    if (existing.payment_method === 'CASH_PICKUP' && existing.order_status === 'PENDING_CONFIRMATION' && orderStatus === 'PROCESSING') {
      const { data: status, error } = await supabase.rpc('confirm_physical_pickup_reservation', { p_order_id: id });
      if (error) throw error;
      if (status !== 'PROCESSING') return NextResponse.json({ error: status || '無法確認面交訂單' }, { status: 400 });
      return NextResponse.json({ success: true });
    }
    const { error } = await supabase.from('physical_orders').update({ order_status: orderStatus }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新訂單失敗' }, { status: 500 });
  }
}
