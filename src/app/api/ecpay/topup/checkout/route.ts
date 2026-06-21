import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMerchantTradeNo, formatEcpayTradeDate, generateCheckMacValue, getEcpayConfig } from '@/lib/ecpay';

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

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: customer.id,
        total_amount: amount,
        tokens_used: 0,
        payment_method: 'ECPAY_TOPUP',
        payment_status: 'PENDING',
        order_status: 'CREATED'
      }])
      .select('id')
      .single();
    if (orderError || !order) throw orderError || new Error('儲值訂單建立失敗');
    orderId = order.id;

    const paymentOrigin = process.env.NEXT_PUBLIC_PAYMENT_SITE_URL || new URL(request.url).origin;
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
      OrderResultURL: `${paymentOrigin}/api/ecpay/topup/result`,
      ClientBackURL: `${paymentOrigin}/?payment=cancelled`,
      ChoosePayment: 'Credit',
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id,
      CustomField2: 'TOPUP'
    };
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
