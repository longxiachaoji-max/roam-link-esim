import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fulfillMicroesimOrderItem } from '@/lib/microesim-fulfillment';
import { verifyMicroesimCallbackToken } from '@/lib/microesim';
import { sendDealerEsimDeliveryEmail } from '@/lib/dealer-delivery-email';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('資料庫服務尚未設定');
  return createClient(url, serviceKey);
}

async function readCallbackBody(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(request: Request) {
  try {
    const body = await readCallbackBody(request) as Record<string, unknown>;
    const nestedData = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : null;
    const topupId = String(body.topup_id || nestedData?.topup_id || '').trim();
    const callbackToken = new URL(request.url).searchParams.get('token') || '';
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(topupId)) {
      return NextResponse.json({ success: false, error: 'topup_id 格式不正確' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: orderItem, error } = await supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        inventory_id,
        supplier_order_ref,
        products ( id, name, supplier, supplier_plan_id, supplier_plan_name, supplier_cost_twd, supplier_raw )
      `)
      .eq('supplier_order_id', topupId)
      .maybeSingle();

    if (error) throw error;
    if (!orderItem?.supplier_order_ref || !verifyMicroesimCallbackToken(orderItem.supplier_order_ref, callbackToken)) {
      return NextResponse.json({ success: false, error: '回呼驗證失敗' }, { status: 401 });
    }
    if (!orderItem || orderItem.inventory_id) {
      return NextResponse.json({ success: true, matched: Boolean(orderItem), completed: Boolean(orderItem?.inventory_id) });
    }

    const product = Array.isArray(orderItem.products) ? orderItem.products[0] : orderItem.products;
    if (!orderItem.product_id || !product?.supplier_plan_id) {
      return NextResponse.json({ success: true, matched: true, completed: false });
    }

    const inventory = await fulfillMicroesimOrderItem(
      supabase,
      orderItem.id,
      orderItem.product_id,
      product
    );
    if (inventory) {
      try {
        await sendDealerEsimDeliveryEmail(supabase, orderItem.id);
      } catch (deliveryError) {
        console.error('Dealer callback delivery email failed:', deliveryError);
      }
    }
    return NextResponse.json({ success: true, matched: true, completed: Boolean(inventory) });
  } catch (error) {
    console.error('MicroEsim callback failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
