import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createMerchantTradeNo,
  formatEcpayTradeDate,
  generateCheckMacValue,
  getEcpayConfig,
  sanitizeEcpayText
} from '@/lib/ecpay';
import { buildReferralQuote, readReferralConfig, saveReferralConfig } from '@/lib/referrals';

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
    if (!accessToken) return NextResponse.json({ error: '請先登入再使用線上付款' }, { status: 401 });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser?.email) return NextResponse.json({ error: '登入狀態已過期，請重新登入' }, { status: 401 });

    const body = await request.json();
    const paymentMethod = body.paymentMethod || 'Credit';
    if (paymentMethod !== 'Credit' && paymentMethod !== 'ApplePay' && paymentMethod !== 'BARCODE') {
      return NextResponse.json({ error: '不支援的付款方式' }, { status: 400 });
    }
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

    const originalTotalAmount = products.reduce((sum, product) => sum + Math.round(Number(product.price)), 0);
    if (!Number.isInteger(originalTotalAmount) || originalTotalAmount <= 0) {
      return NextResponse.json({ error: '訂單金額不正確' }, { status: 400 });
    }
    let totalAmount = originalTotalAmount;
    let referralQuote: ReturnType<typeof buildReferralQuote> | null = null;

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

    const discountCode = String(body.discountCode || '').trim();
    if (discountCode) {
      const { config } = await readReferralConfig(supabase);
      referralQuote = buildReferralQuote(config, authUser.email, discountCode, originalTotalAmount);
      totalAmount = referralQuote.payableTotal;
    }
    if (totalAmount <= 0) {
      return NextResponse.json({ error: '折扣後金額為 0，請改用儲值金結帳' }, { status: 400 });
    }

    if (paymentMethod === 'BARCODE' && (totalAmount < 50 || totalAmount > 20000)) {
      return NextResponse.json({ error: '超商條碼付款金額需介於 NT$50 至 NT$20,000' }, { status: 400 });
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

    if (referralQuote) {
      const { usageGuide, config } = await readReferralConfig(supabase);
      config.pendingRewards[order.id] = {
        orderId: order.id,
        source: 'checkout',
        customerId: customer.id,
        customerEmail: authUser.email.toLowerCase(),
        referrerEmail: referralQuote.referrerEmail,
        code: referralQuote.code,
        originalTotal: originalTotalAmount,
        discountAmount: referralQuote.discountAmount,
        paidTotal: referralQuote.payableTotal,
        buyerRewardPercent: referralQuote.buyerRewardPercent,
        referrerRewardPercent: referralQuote.referrerRewardPercent,
        createdAt: new Date().toISOString()
      };
      await saveReferralConfig(supabase, usageGuide, config);
    }

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
      ClientBackURL: paymentMethod === 'BARCODE'
        ? `${origin}/member?payment=barcode`
        : `${origin}/?payment=cancelled`,
      ChoosePayment: paymentMethod,
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id
    };
    if (paymentMethod === 'BARCODE') {
      fields.StoreExpireDate = '3';
    } else {
      fields.OrderResultURL = `${origin}/api/ecpay/result`;
    }
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
