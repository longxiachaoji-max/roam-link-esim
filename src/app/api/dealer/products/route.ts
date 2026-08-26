import { NextResponse } from 'next/server';
import { authenticationErrorResponse } from '@/lib/server-auth';
import { requireDealerUser } from '@/lib/dealer-auth';

export async function GET(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, country, description, data_amount, validity_days, price')
      .eq('is_active', true)
      .order('country')
      .order('validity_days');
    if (error) throw error;
    const rate = Number(dealer.price_rate_percent);
    return NextResponse.json({
      rate,
      products: (data || []).map(product => ({
        ...product,
        retail_price: Math.round(Number(product.price)),
        dealer_price: Math.max(1, Math.round(Number(product.price) * rate / 100))
      }))
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取經銷商品失敗' }, { status: 500 });
  }
}
