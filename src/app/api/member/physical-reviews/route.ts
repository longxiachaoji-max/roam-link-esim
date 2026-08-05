import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { isVerifiedReviewPurchase, parsePhysicalProductReviewInput } from '@/lib/product-reviews';

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const rawBody = await request.json().catch(() => null);
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody as Record<string, unknown> : {};
    const orderItemId = String(body.orderItemId || '').trim();
    const reviewInput = parsePhysicalProductReviewInput(body);
    if (!orderItemId || !reviewInput) {
      return NextResponse.json({ error: '請完成星級與 2 至 1000 字心得' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: customer, error: customerError } = await supabase.from('customers').select('id').eq('email', user.email.toLowerCase()).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: '找不到會員資料' }, { status: 404 });

    const { data: item, error: itemError } = await supabase
      .from('physical_order_items')
      .select('id, order_id, product_id, physical_orders!inner(id, customer_id, payment_status, order_status)')
      .eq('id', orderItemId)
      .maybeSingle();
    if (itemError) throw itemError;
    const rawOrder = item?.physical_orders;
    const order = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;
    const verified = item && order && isVerifiedReviewPurchase({
      customerId: customer.id,
      orderCustomerId: String(order.customer_id || ''),
      paymentStatus: String(order.payment_status || ''),
      orderStatus: String(order.order_status || ''),
      productId: item.product_id
    });
    if (!verified || !item || !order) {
      return NextResponse.json({ error: '只有已付款且完成的本人訂單可以留下評價' }, { status: 403 });
    }

    const { data: review, error: reviewError } = await supabase
      .from('physical_product_reviews')
      .upsert({
        physical_order_item_id: item.id,
        physical_order_id: order.id,
        physical_product_id: item.product_id,
        customer_id: customer.id,
        rating: reviewInput.rating,
        comment: reviewInput.comment
      }, { onConflict: 'physical_order_item_id' })
      .select('id, rating, comment, is_visible, created_at, updated_at')
      .single();
    if (reviewError) throw reviewError;
    return NextResponse.json({ review });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Submit physical product review error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '評價送出失敗' }, { status: 500 });
  }
}
