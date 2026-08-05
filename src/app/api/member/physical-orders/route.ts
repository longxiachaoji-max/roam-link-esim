import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';
import { canMemberDeletePhysicalOrder, isPhysicalOrderVisibleToMember } from '@/lib/physical-order-visibility';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser(request);
    const supabase = getPhysicalStoreAdmin();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', authUser.email)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      return NextResponse.json({ orders: [] }, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0' }
      });
    }

    const { data, error } = await supabase
      .from('physical_orders')
      .select(`
        id, created_at, updated_at, user_deleted_at, recipient_name, recipient_phone,
        postal_code, shipping_address, shipping_note, delivery_method, subtotal, shipping_fee, total_amount,
        payment_method, payment_status, order_status,
        physical_order_items (
          id, product_id, product_name, product_image, quantity, unit_price,
          rental_start_date, rental_end_date, rental_days, rental_daily_rate,
          physical_product_reviews ( id, rating, comment, is_visible, created_at, updated_at )
        )
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const visibleOrders = (data || []).filter(order => isPhysicalOrderVisibleToMember(order)).map(order => ({
      ...order,
      physical_order_items: (order.physical_order_items || []).map(item => ({
        ...item,
        review: Array.isArray(item.physical_product_reviews) ? item.physical_product_reviews[0] || null : item.physical_product_reviews || null,
        physical_product_reviews: undefined
      }))
    }));

    return NextResponse.json({ orders: visibleOrders }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Member physical orders error:', error);
    return NextResponse.json({ error: '實體商品訂單載入失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser(request);
    const body = await request.json();
    const orderId = String(body.orderId || '').trim();
    if (body.action !== 'soft_delete' || !UUID_PATTERN.test(orderId)) {
      return NextResponse.json({ error: '刪除參數不正確' }, { status: 400 });
    }

    const supabase = getPhysicalStoreAdmin();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', authUser.email.toLowerCase())
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: '找不到會員資料' }, { status: 404 });

    const { data: order, error: orderError } = await supabase
      .from('physical_orders')
      .select('id, order_status, user_deleted_at')
      .eq('id', orderId)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: '找不到此訂單' }, { status: 404 });
    if (!canMemberDeletePhysicalOrder(order.order_status, order.user_deleted_at) && !order.user_deleted_at) {
      return NextResponse.json({ error: '訂單完成後才可刪除紀錄' }, { status: 409 });
    }

    if (order.user_deleted_at) {
      return NextResponse.json({ success: true, userDeletedAt: order.user_deleted_at });
    }

    const userDeletedAt = new Date().toISOString();
    const { data: updatedOrder, error: updateError } = await supabase
      .from('physical_orders')
      .update({ user_deleted_at: userDeletedAt })
      .eq('id', orderId)
      .eq('customer_id', customer.id)
      .is('user_deleted_at', null)
      .select('user_deleted_at')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedOrder) return NextResponse.json({ error: '訂單狀態已變更，請重新整理' }, { status: 409 });

    return NextResponse.json({
      success: true,
      userDeletedAt: updatedOrder.user_deleted_at,
      message: '已標記刪除，24 小時後將從會員中心隱藏'
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Member physical order deletion error:', error);
    return NextResponse.json({ error: '實體商品訂單刪除失敗' }, { status: 500 });
  }
}
