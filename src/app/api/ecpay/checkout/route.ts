import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createMerchantTradeNo,
  formatEcpayTradeDate,
  generateCheckMacValue,
  getEcpayConfig,
  sanitizeEcpayText
} from '@/lib/ecpay';
import { isDealerReferralDiscount, isPromoDiscount, resolveCheckoutDiscount, type CheckoutDiscountQuote } from '@/lib/checkout-discounts';
import { parseReferralConfig, saveReferralConfig, type ReferralQuote } from '@/lib/referrals';
import { recordDealerReferralCommission, type DealerReferralQuote } from '@/lib/dealer-referrals';
import { parsePaymentLimits } from '@/lib/payment-limits';
import { sendBarcodePaymentCreatedAlert } from '@/lib/barcode-payment-alerts';
import { createEcpayBackgroundBarcode } from '@/lib/ecpay-background-barcode';

export const dynamic = 'force-dynamic';

interface CheckoutProduct {
  id: string;
  name: string;
  price: number;
  country: string | null;
}

interface PendingCheckoutOrder {
  id: string;
  order_number: string;
  total_amount: number | string;
  original_total_amount: number | string | null;
  discount_amount: number | string | null;
  promo_code_id: string | null;
  promo_code_snapshot: string | null;
  dealer_referral_id: string | null;
  dealer_referral_code_snapshot: string | null;
  ecpay_payment_method: string | null;
  ecpay_barcode_created_at: string | null;
  payment_proof_uploaded_at: string | null;
  order_items: Array<{ product_id: string | null; price: number | string }>;
}

function checkoutItemSignature(items: Array<{ product_id: string | null; price: number | string }>) {
  return items
    .map(item => `${item.product_id || ''}:${Math.round(Number(item.price))}`)
    .sort()
    .join('|');
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('資料庫服務尚未設定');
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  let orderId = '';
  let createdNewOrder = false;
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
    let discountQuote: CheckoutDiscountQuote | null = null;
    let referralQuote: ReferralQuote | null = null;
    let dealerReferralQuote: DealerReferralQuote | null = null;

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

    const discountCode = String(body.discountCode || authUser.user_metadata?.referral_code || '').trim();
    if (discountCode) {
      discountQuote = await resolveCheckoutDiscount(supabase, authUser.email, discountCode, originalTotalAmount);
      totalAmount = discountQuote.payableTotal;
      if (discountQuote.source === 'referral') referralQuote = discountQuote;
      if (isDealerReferralDiscount(discountQuote)) dealerReferralQuote = discountQuote;
    }
    if (totalAmount <= 0) {
      return NextResponse.json({ error: '折扣後金額為 0，請改用儲值金結帳' }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();
    const referralConfig = parseReferralConfig(settings?.usage_guide || '');
    const paymentLimits = parsePaymentLimits(settings?.usage_guide);
    const limit = paymentMethod === 'BARCODE'
      ? { min: paymentLimits.barcode_min, max: paymentLimits.barcode_max, label: '超商條碼付款' }
      : { min: paymentLimits.credit_min, max: paymentLimits.credit_max, label: paymentMethod === 'ApplePay' ? 'Apple Pay' : '信用卡付款' };

    if (totalAmount < limit.min || totalAmount > limit.max) {
      return NextResponse.json({ error: `${limit.label}金額需介於 NT$${limit.min.toLocaleString()} 至 NT$${limit.max.toLocaleString()}` }, { status: 400 });
    }

    const merchantTradeNo = createMerchantTradeNo();
    const promoCodeId = isPromoDiscount(discountQuote) ? discountQuote.promoCodeId : null;
    const promoCodeSnapshot = isPromoDiscount(discountQuote) ? discountQuote.code : null;
    const discountAmount = discountQuote?.discountAmount || 0;
    const currentItemSignature = checkoutItemSignature(products.map(product => ({
      product_id: product.id,
      price: product.price
    })));
    const reusableSince = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const { data: pendingOrders, error: pendingOrdersError } = await supabase
      .from('orders')
      .select(`
        id, order_number, total_amount, original_total_amount, discount_amount,
        promo_code_id, promo_code_snapshot, dealer_referral_id, dealer_referral_code_snapshot, ecpay_payment_method,
        ecpay_barcode_created_at, payment_proof_uploaded_at,
        order_items ( product_id, price )
      `)
      .eq('customer_id', customer.id)
      .eq('payment_method', 'ECPAY')
      .eq('payment_status', 'PENDING')
      .gte('created_at', reusableSince)
      .order('created_at', { ascending: false })
      .limit(10);
    if (pendingOrdersError) throw pendingOrdersError;

    const reusableOrder = ((pendingOrders || []) as unknown as PendingCheckoutOrder[]).find(candidate => {
      const pendingReferralCode = referralConfig.pendingRewards[candidate.id]?.code || null;
      return !candidate.payment_proof_uploaded_at
        && candidate.ecpay_payment_method !== 'BARCODE'
        && !candidate.ecpay_barcode_created_at
        && Math.round(Number(candidate.total_amount)) === totalAmount
        && Math.round(Number(candidate.original_total_amount)) === originalTotalAmount
        && Math.round(Number(candidate.discount_amount || 0)) === discountAmount
        && candidate.promo_code_id === promoCodeId
        && candidate.promo_code_snapshot === promoCodeSnapshot
        && candidate.dealer_referral_id === (dealerReferralQuote?.dealerId || null)
        && candidate.dealer_referral_code_snapshot === (dealerReferralQuote?.code || null)
        && pendingReferralCode === (referralQuote?.code || null)
        && checkoutItemSignature(candidate.order_items || []) === currentItemSignature;
    });

    let order: { id: string; order_number: string } | null = null;
    if (reusableOrder) {
      const { data: updatedOrder, error: reuseError } = await supabase
        .from('orders')
        .update({
          ecpay_payment_method: paymentMethod,
          ecpay_merchant_trade_no: merchantTradeNo,
          ecpay_barcode_created_at: paymentMethod === 'BARCODE' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reusableOrder.id)
        .eq('payment_status', 'PENDING')
        .select('id, order_number')
        .maybeSingle();
      if (reuseError) throw reuseError;
      order = updatedOrder;
    }

    if (!order) {
      const { data: insertedOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: customer.id,
          total_amount: totalAmount,
          original_total_amount: originalTotalAmount,
          discount_amount: discountAmount,
          promo_code_id: promoCodeId,
          promo_code_snapshot: promoCodeSnapshot,
          dealer_referral_id: dealerReferralQuote?.dealerId || null,
          dealer_referral_code_snapshot: dealerReferralQuote?.code || null,
          tokens_used: 0,
          payment_method: 'ECPAY',
          ecpay_payment_method: paymentMethod,
          ecpay_merchant_trade_no: merchantTradeNo,
          ecpay_barcode_created_at: paymentMethod === 'BARCODE' ? new Date().toISOString() : null,
          payment_status: 'PENDING',
          order_status: 'CREATED'
        }])
        .select('id, order_number')
        .single();
      if (orderError || !insertedOrder) throw orderError || new Error('建立訂單失敗');
      order = insertedOrder;
      createdNewOrder = true;
    }
    orderId = order.id;

    if (createdNewOrder) {
      const { error: itemsError } = await supabase.from('order_items').insert(products.map(product => ({
        order_id: order.id,
        product_id: product.id,
        inventory_id: null,
        price: product.price
      })));
      if (itemsError) throw itemsError;
    }

    if (referralQuote) {
      referralConfig.pendingRewards[order.id] = {
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
      await saveReferralConfig(supabase, settings?.usage_guide || '', referralConfig);
    }

    if (dealerReferralQuote) {
      await recordDealerReferralCommission(supabase, order.id, dealerReferralQuote, products.length, false);
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const itemName = sanitizeEcpayText(products.map(product => product.name).join('#'), 200);
    if (paymentMethod === 'BARCODE') {
      const barcode = await createEcpayBackgroundBarcode({
        merchantTradeNo,
        amount: totalAmount,
        orderId: order.id,
        returnUrl: `${origin}/api/ecpay/notify`,
        expireDays: 3,
        tradeDesc: 'Roam Link eSIM',
        itemName: itemName || 'Roam Link eSIM'
      });
      const barcodeCreatedAt = new Date().toISOString();
      const { error: barcodeSaveError } = await supabase
        .from('orders')
        .update({
          ecpay_trade_no: barcode.tradeNo || null,
          ecpay_barcode_1: barcode.barcode1,
          ecpay_barcode_2: barcode.barcode2,
          ecpay_barcode_3: barcode.barcode3,
          ecpay_barcode_expires_at: barcode.expiresAt,
          ecpay_barcode_created_at: barcodeCreatedAt,
          updated_at: barcodeCreatedAt
        })
        .eq('id', order.id)
        .eq('payment_status', 'PENDING');
      if (barcodeSaveError) throw barcodeSaveError;

      await sendBarcodePaymentCreatedAlert(supabase, {
        orderId: order.id,
        orderNumber: order.order_number,
        customerEmail: authUser.email,
        amount: totalAmount,
        purpose: 'eSIM 商品',
        itemNames: products.map(product => product.name),
        merchantTradeNo
      });

      return NextResponse.json({
        barcodeReady: true,
        orderId: order.id,
        orderNumber: order.order_number,
        redirect: `${origin}/member?payment=barcode`
      });
    }

    const { merchantId, hashKey, hashIv, checkoutUrl } = getEcpayConfig();
    const fields: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatEcpayTradeDate(),
      PaymentType: 'aio',
      TotalAmount: String(totalAmount),
      TradeDesc: 'Roam Link eSIM',
      ItemName: itemName || 'Roam Link eSIM',
      ReturnURL: `${origin}/api/ecpay/notify`,
      ClientBackURL: `${origin}/?payment=cancelled`,
      ChoosePayment: paymentMethod,
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id
    };
    fields.OrderResultURL = `${origin}/api/ecpay/result`;
    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);

    return NextResponse.json({ action: checkoutUrl, fields, orderId: order.id, orderNumber: order.order_number });
  } catch (error) {
    console.error('Create ECPay checkout error:', error);
    if (orderId && createdNewOrder) {
      try {
        await getSupabase().from('orders').delete().eq('id', orderId).eq('payment_status', 'PENDING');
      } catch (cleanupError) {
        console.error('Failed to clean up ECPay order:', cleanupError);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : '建立綠界付款失敗' }, { status: 500 });
  }
}
