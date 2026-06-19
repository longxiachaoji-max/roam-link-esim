import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createMerchantTradeNo,
  formatEcpayTradeDate,
  generateCheckMacValue,
  getEcpayConfig,
  sanitizeEcpayText
} from '@/lib/ecpay';

export const dynamic = 'force-dynamic';

interface CheckoutProduct {
  id: string;
  name: string;
  price: number;
  country: string | null;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('資料庫服務尚未設定');
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  let orderId = '';
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!accessToken) return NextResponse.json({ error: '請先登入再使用信用卡付款' }, { status: 401 });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser?.email) return NextResponse.json({ error: '登入狀態已過期，請重新登入' }, { status: 401 });

    const body = await request.json();
    const productIds: string[] = Array.isArray(body.productIds)
      ? body.productIds.map((id: unknown) => String(id || '')).filter(Boolean)
      : [];
    if (!productIds.length || productIds.length > 20) {
      return NextResponse.json({ error: '購物車內容不正確' }, { status: 400 });
    }

    const uniqueProductIds = [...new Set(productIds)];
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('id, name, price, country')
      .in('id', uniqueProductIds);
    if (productError) throw productError;

    const productMap = new Map<string, CheckoutProduct>(
      (productRows || []).map(product => [product.id, product as CheckoutProduct])
    );
    const products = productIds
      .map(id => productMap.get(id))
      .filter((product): product is CheckoutProduct => Boolean(product));
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: '部分商品已下架，請重新整理購物車' }, { status: 400 });
    }

    const totalAmount = products.reduce((sum, product) => sum + Math.round(Number(product.price)), 0);
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: '訂單金額不正確' }, { status: 400 });
    }

    let { data: customer } = await supabase.from('customers').select('*').eq('email', authUser.email).single();
    if (!customer) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email.split('@')[0],
          token_balance: 0
        }])
        .select()
        .single();
      if (customerError) throw customerError;
      customer = newCustomer;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: customer.id,
        total_amount: totalAmount,
        tokens_used: 0,
        payment_method: 'ECPAY',
        payment_status: 'PENDING',
        order_status: 'CREATED'
      }])
      .select('id')
      .single();
    if (orderError || !order) throw orderError || new Error('建立訂單失敗');
    orderId = order.id;

    const { error: itemsError } = await supabase.from('order_items').insert(products.map(product => ({
      order_id: order.id,
      product_id: product.id,
      inventory_id: null,
      price: product.price
    })));
    if (itemsError) throw itemsError;

    const { merchantId, hashKey, hashIv, checkoutUrl } = getEcpayConfig();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const itemName = sanitizeEcpayText(products.map(product => product.name).join('#'), 200);
    const fields: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: createMerchantTradeNo(),
      MerchantTradeDate: formatEcpayTradeDate(),
      PaymentType: 'aio',
      TotalAmount: String(totalAmount),
      TradeDesc: 'Roam Link eSIM',
      ItemName: itemName || 'Roam Link eSIM',
      ReturnURL: `${origin}/api/ecpay/notify`,
      OrderResultURL: `${origin}/api/ecpay/result`,
      ClientBackURL: `${origin}/?payment=cancelled`,
      ChoosePayment: 'Credit',
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id
    };
    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);

    return NextResponse.json({ action: checkoutUrl, fields, orderId: order.id });
  } catch (error) {
    console.error('Create ECPay checkout error:', error);
    if (orderId) {
      try {
        await getSupabase().from('orders').delete().eq('id', orderId).eq('payment_status', 'PENDING');
      } catch (cleanupError) {
        console.error('Failed to clean up ECPay order:', cleanupError);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : '建立綠界付款失敗' }, { status: 500 });
  }
}
