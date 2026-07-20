import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

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
        id, created_at, updated_at, recipient_name, recipient_phone,
        postal_code, shipping_address, shipping_note, total_amount,
        payment_method, payment_status, order_status,
        physical_order_items (
          id, product_name, product_image, quantity, unit_price,
          rental_start_date, rental_end_date, rental_days, rental_daily_rate
        )
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ orders: data || [] }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Member physical orders error:', error);
    return NextResponse.json({ error: '實體商品訂單載入失敗' }, { status: 500 });
  }
}
