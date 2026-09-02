import { NextResponse } from 'next/server';
import { authenticationErrorResponse } from '@/lib/server-auth';
import { requireDealerUser } from '@/lib/dealer-auth';

export async function GET(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    let query = supabase
      .from('products')
      .select('id, name, country, description, data_amount, validity_days, price, supplier_cost_twd')
      .eq('is_active', true)
      .order('country')
      .order('validity_days');
    if (dealer.sales_mode !== 'referral') query = query.gt('supplier_cost_twd', 0);
    const { data, error } = await query;
    if (error) throw error;

    if (dealer.sales_mode === 'referral') {
      const discountPercent = Math.max(0, Number(dealer.referral_discount_percent) || 0);
      const commissionMode = dealer.referral_commission_mode === 'fixed' ? 'fixed' : 'percentage';
      const commissionValue = Math.max(0, Number(dealer.referral_commission_value) || 0);
      return NextResponse.json({
        salesMode: 'referral',
        products: (data || []).map(({ supplier_cost_twd: _supplierCost, ...product }) => {
          const retailPrice = Math.round(Number(product.price));
          const payablePrice = Math.max(0, retailPrice - Math.round(retailPrice * discountPercent / 100));
          return {
            ...product,
            retail_price: retailPrice,
            commission_amount: commissionMode === 'fixed'
              ? Math.round(commissionValue)
              : Math.round(payablePrice * commissionValue / 100)
          };
        })
      });
    }

    const pricingMode = dealer.pricing_mode || 'fixed_markup';
    const pricingValue = Number(dealer.pricing_value ?? 10);
    return NextResponse.json({
      salesMode: 'direct',
      products: (data || []).map(({ supplier_cost_twd, ...product }) => ({
        ...product,
        retail_price: Math.round(Number(product.price)),
        dealer_price: pricingMode === 'percentage_markup'
          ? Math.round(Number(supplier_cost_twd) * (1 + pricingValue / 100))
          : Math.round(Number(supplier_cost_twd) + pricingValue)
      }))
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取經銷商品失敗' }, { status: 500 });
  }
}
