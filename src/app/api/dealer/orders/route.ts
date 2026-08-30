import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireDealerUser } from '@/lib/dealer-auth';
import { sendDealerEsimDeliveryEmail } from '@/lib/dealer-delivery-email';
import { fulfillMicroesimOrderItem } from '@/lib/microesim-fulfillment';
import { sendMicroesimFulfillmentFailureAlert } from '@/lib/order-alerts';
import { authenticationErrorResponse } from '@/lib/server-auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DealerProduct {
  id: string;
  name: string;
  country: string;
  validity_days: number;
  price: number | string;
  supplier?: string | null;
  supplier_plan_id?: string | null;
  supplier_plan_name?: string | null;
  supplier_cost_twd?: number | string | null;
  supplier_raw?: Record<string, unknown> | null;
}

async function claimInventory(
  supabase: Awaited<ReturnType<typeof requireDealerUser>>['supabase'],
  orderItemId: string,
  productId: string
) {
  const { data: candidates, error } = await supabase
    .from('e_sim_inventory')
    .select('id')
    .eq('product_id', productId)
    .eq('status', 'AVAILABLE')
    .limit(4);
  if (error) throw error;

  for (const candidate of candidates || []) {
    const { data: claimed, error: claimError } = await supabase
      .from('e_sim_inventory')
      .update({ status: 'SOLD', sold_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('status', 'AVAILABLE')
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    const { data: bound, error: bindError } = await supabase
      .from('order_items')
      .update({ inventory_id: claimed.id })
      .eq('id', orderItemId)
      .is('inventory_id', null)
      .select('id')
      .maybeSingle();
    if (bindError) throw bindError;
    if (bound) return true;
    await supabase.from('e_sim_inventory').update({ status: 'AVAILABLE', sold_at: null }).eq('id', claimed.id);
  }
  return false;
}

async function getOrCreateCustomer(
  supabase: Awaited<ReturnType<typeof requireDealerUser>>['supabase'],
  email: string,
  name: string
) {
  const existing = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('customers')
    .insert({ email, name: name || null, token_balance: 0 })
    .select('id')
    .maybeSingle();
  if (!created.error && created.data) return created.data;
  if (created.error && /duplicate|unique/i.test(created.error.message || '')) {
    const retry = await supabase.from('customers').select('id').eq('email', email).single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
  throw created.error || new Error('建立客戶資料失敗');
}

export async function GET(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    const { data: orders, error } = await supabase
      .from('dealer_orders')
      .select(`
        id, fulfillment_order_id, customer_email, customer_name,
        retail_total, dealer_total, price_rate_percent, created_at,
        orders ( order_number, order_status, payment_status ),
        dealer_order_items (
          id, order_item_id, retail_price, dealer_price,
          delivery_email_status, delivery_email_error,
          products ( name, country, validity_days ),
          order_items (
            inventory_id, supplier_status,
            e_sim_inventory ( iccid, microesim_usage_cache, microesim_usage_checked_at )
          )
        )
      `)
      .eq('dealer_id', dealer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const deliveryItemIds: string[] = [];
    for (const order of orders || []) {
      const items = Array.isArray(order.dealer_order_items) ? order.dealer_order_items : [];
      for (const item of items) {
        const normalItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
        if (normalItem?.inventory_id && item.delivery_email_status !== 'sent') {
          deliveryItemIds.push(item.order_item_id);
        }
      }
    }
    if (deliveryItemIds.length) {
      const deliveryResults = await Promise.allSettled(
        deliveryItemIds.map(itemId => sendDealerEsimDeliveryEmail(supabase, itemId))
      );
      deliveryResults.forEach(result => {
        if (result.status === 'rejected') console.error('Deferred dealer delivery email failed:', result.reason);
      });
    }
    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取經銷訂單失敗' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    const body = await request.json();
    const dealerOrderId = String(body.dealerOrderId || '');
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase().slice(0, 255);

    if (!/^[0-9a-f-]{36}$/i.test(dealerOrderId)) {
      return NextResponse.json({ error: '訂單資料不正確' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(customerEmail)) {
      return NextResponse.json({ error: '請輸入正確的客戶 Email' }, { status: 400 });
    }

    const { data: dealerOrder, error: orderError } = await supabase
      .from('dealer_orders')
      .select(`
        id, fulfillment_order_id, customer_name,
        dealer_order_items (
          id, order_item_id,
          order_items ( inventory_id )
        )
      `)
      .eq('id', dealerOrderId)
      .eq('dealer_id', dealer.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!dealerOrder) {
      return NextResponse.json({ error: '找不到這筆經銷訂單' }, { status: 404 });
    }

    const customer = await getOrCreateCustomer(supabase, customerEmail, dealerOrder.customer_name || '');
    const { error: emailUpdateError } = await supabase
      .from('dealer_orders')
      .update({ customer_email: customerEmail })
      .eq('id', dealerOrder.id)
      .eq('dealer_id', dealer.id);
    if (emailUpdateError) throw emailUpdateError;

    const { error: customerUpdateError } = await supabase
      .from('orders')
      .update({ customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq('id', dealerOrder.fulfillment_order_id);
    if (customerUpdateError) throw customerUpdateError;

    const dealerItems = Array.isArray(dealerOrder.dealer_order_items) ? dealerOrder.dealer_order_items : [];
    const dealerItemIds = dealerItems.map(item => item.id);
    if (dealerItemIds.length) {
      const { error: resetError } = await supabase
        .from('dealer_order_items')
        .update({ delivery_email_status: 'pending', delivery_email_sent_at: null, delivery_email_error: null })
        .in('id', dealerItemIds);
      if (resetError) throw resetError;
    }

    const readyItemIds = dealerItems.flatMap(item => {
      const normalItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
      return normalItem?.inventory_id ? [item.order_item_id] : [];
    });
    const results = await Promise.allSettled(
      readyItemIds.map(itemId => sendDealerEsimDeliveryEmail(supabase, itemId))
    );
    const failedCount = results.filter(result => result.status === 'rejected').length;

    if (failedCount) {
      return NextResponse.json({
        error: `${failedCount} 封郵件寄送失敗，Email 已更新，可稍後再試`,
        emailUpdated: true
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      customerEmail,
      sentCount: readyItemIds.length,
      pendingCount: dealerItems.length - readyItemIds.length
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Dealer order email resend failed:', error);
    return NextResponse.json({ error: '更新 Email 或再次寄送失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    const body = await request.json();
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase().slice(0, 255);
    const customerName = String(body.customerName || '').trim().slice(0, 120);
    const productIds: string[] = Array.isArray(body.productIds)
      ? body.productIds.map((id: unknown) => String(id)).filter((id: string) => /^[0-9a-f-]{36}$/i.test(id))
      : [];
    if (!EMAIL_PATTERN.test(customerEmail)) {
      return NextResponse.json({ error: '請輸入正確的客戶 Email' }, { status: 400 });
    }
    if (!productIds.length || productIds.length > 20 || productIds.length !== body.productIds.length) {
      return NextResponse.json({ error: '商品內容不正確' }, { status: 400 });
    }

    const uniqueIds = [...new Set(productIds)];
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('id, name, country, validity_days, price, is_active, supplier, supplier_plan_id, supplier_plan_name, supplier_cost_twd, supplier_raw')
      .in('id', uniqueIds);
    if (productError) throw productError;
    const productMap = new Map((productRows || []).map(row => [row.id, row as DealerProduct & { is_active: boolean }]));
    if (productIds.some(id => !productMap.get(id)?.is_active)) {
      return NextResponse.json({ error: '部分商品已下架，請重新整理後再試' }, { status: 400 });
    }

    const customer = await getOrCreateCustomer(supabase, customerEmail, customerName);
    const { data: checkoutRows, error: checkoutError } = await supabase.rpc('create_atomic_dealer_order', {
      p_dealer_id: dealer.id,
      p_customer_id: customer.id,
      p_customer_email: customerEmail,
      p_customer_name: customerName,
      p_product_ids: productIds
    });
    if (checkoutError || !checkoutRows?.[0]) {
      if (checkoutError?.message.includes('INSUFFICIENT_BALANCE')) {
        return NextResponse.json({ error: '經銷商餘額不足，請先申請加值' }, { status: 400 });
      }
      if (checkoutError?.message.includes('PRODUCT_NOT_AVAILABLE')) {
        return NextResponse.json({ error: '部分商品已下架，請重新整理後再試' }, { status: 400 });
      }
      throw checkoutError || new Error('建立經銷訂單失敗');
    }
    const checkout = checkoutRows[0];
    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select('id, product_id')
      .eq('order_id', checkout.order_id)
      .order('created_at');
    if (itemError) throw itemError;

    let pendingCount = 0;
    for (const item of orderItems || []) {
      const product = productMap.get(item.product_id);
      if (!product) continue;
      let fulfilled = await claimInventory(supabase, item.id, product.id);
      if (!fulfilled) {
        try {
          fulfilled = Boolean(await fulfillMicroesimOrderItem(supabase, item.id, product.id, product));
        } catch (error) {
          console.error('Dealer MicroEsim fulfillment failed:', error);
          await sendMicroesimFulfillmentFailureAlert(supabase, {
            source: '經銷商代客下單',
            orderId: checkout.order_id,
            orderItemId: item.id,
            customerEmail,
            productName: product.name,
            country: product.country,
            validityDays: product.validity_days,
            supplierPlanId: product.supplier_plan_id,
            error
          });
        }
      }
      if (fulfilled) {
        try {
          await sendDealerEsimDeliveryEmail(supabase, item.id);
        } catch (error) {
          console.error('Dealer delivery email failed:', error);
        }
      } else {
        pendingCount += 1;
      }
    }

    await supabase
      .from('orders')
      .update({ order_status: pendingCount ? 'PENDING' : 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', checkout.order_id);

    if (pendingCount) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        await resend.emails.send({
          from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
          to: [customerEmail],
          subject: `eSIM 訂單正在準備中：${checkout.order_number}`,
          html: '<p>我們已收到 eSIM 訂單，系統正在準備安裝資料。完成後會直接寄送 QR Code 與一鍵安裝連結到此信箱。</p>'
        });
      } catch (error) {
        console.error('Dealer pending email failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      orderNumber: checkout.order_number,
      dealerOrderId: checkout.dealer_order_id,
      dealerTotal: checkout.dealer_total,
      newBalance: checkout.new_balance,
      pendingCount
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Dealer order failed:', error);
    return NextResponse.json({ error: '建立訂單失敗，款項若已扣除可在經銷訂單查看' }, { status: 500 });
  }
}
