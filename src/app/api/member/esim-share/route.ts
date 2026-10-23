import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { createEsimShareToken, getEsimShareSecret } from '@/lib/esim-share-token';

export const dynamic = 'force-dynamic';

// POST - 為會員自己的 eSIM 產生安裝分享網址
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const orderItemId = typeof body?.order_item_id === 'string' ? body.order_item_id : '';
    if (!orderItemId) {
      return NextResponse.json({ error: '缺少 eSIM 資料' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: '找不到會員資料' }, { status: 404 });
    }

    const { data: item, error } = await supabase
      .from('order_items')
      .select('id, inventory_id, user_deleted_at, orders!inner ( customer_id, payment_status )')
      .eq('id', orderItemId)
      .eq('orders.customer_id', customer.id)
      .maybeSingle();
    if (error) throw error;
    if (!item || !item.inventory_id || item.user_deleted_at) {
      return NextResponse.json({ error: '找不到可分享的 eSIM' }, { status: 404 });
    }

    const token = createEsimShareToken(item.id, getEsimShareSecret());
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/install/${token}` });
  } catch (error: unknown) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Create eSIM share link failed:', error);
    return NextResponse.json({ error: '產生分享網址失敗，請稍後再試' }, { status: 500 });
  }
}
