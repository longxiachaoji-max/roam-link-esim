import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { isVerifiedReviewPurchase, parseProductReviewInput } from '@/lib/product-reviews';

type QueryRelation<T> = T | T[] | null;

interface ReviewOrder {
  id: string;
  customer_id: string;
  payment_status: string;
  order_status: string;
}

interface ReviewOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  orders: QueryRelation<ReviewOrder>;
}

function firstRelation<T>(value: QueryRelation<T>) {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const rawBody = await request.json().catch(() => null);
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? rawBody as Record<string, unknown>
      : {};
    const orderItemId = String(body.orderItemId || '').trim();
    const reviewInput = parseProductReviewInput(body);

    if (!orderItemId || !reviewInput) {
      return NextResponse.json({ error: '請完成星級、使用順暢度與 2 至 1000 字心得' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: '找不到會員資料' }, { status: 404 });

    const { data, error: itemError } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        orders!inner ( id, customer_id, payment_status, order_status )
      `)
      .eq('id', orderItemId)
      .maybeSingle();
    if (itemError) throw itemError;

    const item = data as unknown as ReviewOrderItem | null;
    const order = item ? firstRelation(item.orders) : null;
    const isVerifiedPurchase = item && order && isVerifiedReviewPurchase({
      customerId: customer.id,
      orderCustomerId: order.customer_id,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      productId: item.product_id
    });
    if (!isVerifiedPurchase || !item || !order || !item.product_id) {
      return NextResponse.json({ error: '只有已付款且完成的本人訂單可以留下評價' }, { status: 403 });
    }

    const { data: review, error: reviewError } = await supabase
      .from('product_reviews')
      .upsert({
        order_item_id: item.id,
        order_id: order.id,
        product_id: item.product_id,
        customer_id: customer.id,
        rating: reviewInput.rating,
        smoothness_rating: reviewInput.smoothnessRating,
        comment: reviewInput.comment
      }, { onConflict: 'order_item_id' })
      .select('id, rating, smoothness_rating, comment, is_visible, created_at, updated_at')
      .single();
    if (reviewError) throw reviewError;

    return NextResponse.json({ review });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Submit product review error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '評價送出失敗' }, { status: 500 });
  }
}
