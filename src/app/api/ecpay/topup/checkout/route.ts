import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMerchantTradeNo, formatEcpayTradeDate, generateCheckMacValue, getEcpayConfig } from '@/lib/ecpay';
import { buildReferralRewardQuote, readReferralConfig, saveReferralConfig } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

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
    if (!accessToken) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser?.email) return NextResponse.json({ error: '登入狀態已過期' }, { status: 401 });

    const body = await request.json();
    const amount = Number(body.amount);
    const paymentMethod = String(body.paymentMethod || 'Credit');
    if (paymentMethod !== 'Credit' && paymentMethod !== 'ApplePay' && paymentMethod !== 'BARCODE') {
      return NextResponse.json({ error: '不支援的儲值付款方式' }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount < 200 || amount > 100000) {
      return NextResponse.json({ error: '儲值金額需介於 NT$200 至 NT$100,000' }, { status: 400 });
    }

    let { data: customer } = await supabase.from('customers').select('id').eq('email', authUser.email).single();
    if (!customer) {
      const { data: createdCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{ email: authUser.email, name: authUser.user_metadata?.name || authUser.email.split('@')[0], token_balance: 0 }])
        .select('id')
        .single();
      if (customerError) throw customerError;
      customer = createdCustomer;
    }

    const referralCode = String(body.referralCode || '').trim();
    let referralQuote: ReturnType<typeof buildReferralRewardQuote> | null = null;
    if (referralCode) {
      const { config } = await readReferralConfig(supabase);
      referralQuote = buildReferralRewardQuote(config, authUser.email, referralCode, amount);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: customer.id,
        total_amount: amount,
        tokens_used: referralQuote ? 1 : 0,
        payment_method: 'ECPAY_TOPUP',
        payment_status: 'PENDING',
        order_status: 'CREATED'
      }])
      .select('id')
      .single();
    if (orderError || !order) throw orderError || new Error('儲值訂單建立失敗');
    orderId = order.id;

    if (referralQuote) {
      const { usageGuide, config } = await readReferralConfig(supabase);
      config.pendingRewards[order.id] = {
        orderId: order.id,
        source: 'topup',
        customerId: customer.id,
        customerEmail: authUser.email.toLowerCase(),
        referrerEmail: referralQuote.referrerEmail,
        code: referralQuote.code,
        originalTotal: amount,
        discountAmount: 0,
        paidTotal: amount,
        buyerRewardPercent: referralQuote.buyerRewardPercent,
        referrerRewardPercent: referralQuote.referrerRewardPercent,
        createdAt: new Date().toISOString()
      };
      await saveReferralConfig(supabase, usageGuide, config);
    }

    let paymentOrigin = process.env.NEXT_PUBLIC_PAYMENT_SITE_URL || new URL(request.url).origin;
    if (body.returnOrigin) {
      const parsedOrigin = new URL(String(body.returnOrigin));
      if (parsedOrigin.protocol === 'https:' || parsedOrigin.hostname === 'localhost') {
        paymentOrigin = parsedOrigin.origin;
      }
    }
    const returnPath = String(body.returnPath || '/');
    const safeReturnPath = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/';
    const { merchantId, hashKey, hashIv, checkoutUrl } = getEcpayConfig();
    const fields: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: createMerchantTradeNo(),
      MerchantTradeDate: formatEcpayTradeDate(),
      PaymentType: 'aio',
      TotalAmount: String(amount),
      TradeDesc: 'Catch the Moment Member Topup',
      ItemName: `拾機會員儲值金 ${amount}元`,
      ReturnURL: `${paymentOrigin}/api/ecpay/topup/notify`,
      ClientBackURL: paymentMethod === 'BARCODE'
        ? `${paymentOrigin}${safeReturnPath}?payment=barcode`
        : `${paymentOrigin}${safeReturnPath}?payment=cancelled`,
      ChoosePayment: paymentMethod,
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id,
      CustomField2: 'TOPUP',
      CustomField3: safeReturnPath
    };
    if (paymentMethod === 'BARCODE') {
      fields.StoreExpireDate = '3';
    } else {
      fields.OrderResultURL = `${paymentOrigin}/api/ecpay/topup/result`;
    }
    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);

    return NextResponse.json({ action: checkoutUrl, fields });
  } catch (error) {
    if (orderId) {
      try {
        await getSupabase().from('orders').delete().eq('id', orderId).eq('payment_status', 'PENDING');
      } catch (cleanupError) {
        console.error('Failed to clean up topup order:', cleanupError);
      }
    }
    console.error('Create ECPay topup error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '建立儲值付款失敗' }, { status: 500 });
  }
}
