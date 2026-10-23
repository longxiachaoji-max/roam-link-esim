import { after, NextResponse } from 'next/server';
import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { markEcpayOrderPaidAndFulfill } from '@/lib/ecpay-orders';

export const dynamic = 'force-dynamic';
// 背景配發多張 eSIM 需要時間
export const maxDuration = 300;

export async function POST(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  try {
    const params = formDataToParams(await request.formData());
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);

    const tradeAmount = Number(params.TradeAmt);
    if (!verified || params.RtnCode !== '1' || params.SimulatePaid === '1' || !params.CustomField1 || !Number.isFinite(tradeAmount)) {
      return NextResponse.redirect(`${origin}/?payment=failed`, 303);
    }

    // 先確認付款就把客人導回會員中心，配發在背景進行（會員中心會顯示處理中）
    await markEcpayOrderPaidAndFulfill(params.CustomField1, tradeAmount, {
      merchantTradeNo: params.MerchantTradeNo,
      runInBackground: task => after(task)
    });
    return NextResponse.redirect(`${origin}/member?payment=success`, 303);
  } catch (error) {
    console.error('ECPay result error:', error);
    return NextResponse.redirect(`${origin}/member?payment=pending`, 303);
  }
}
