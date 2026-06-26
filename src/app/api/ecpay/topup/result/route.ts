import { NextResponse } from 'next/server';
import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { markEcpayTopupPaid } from '@/lib/ecpay-topups';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const paymentOrigin = new URL(request.url).origin;
  try {
    const params = formDataToParams(await request.formData());
    const returnPath = params.CustomField3 && params.CustomField3.startsWith('/') && !params.CustomField3.startsWith('//')
      ? params.CustomField3
      : '/';
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);
    const tradeAmount = Number(params.TradeAmt);

    if (!verified || params.RtnCode !== '1' || params.SimulatePaid === '1' || params.CustomField2 !== 'TOPUP' || !params.CustomField1 || !Number.isFinite(tradeAmount)) {
      return NextResponse.redirect(`${paymentOrigin}${returnPath}?payment=failed`, 303);
    }

    const result = await markEcpayTopupPaid(params.CustomField1, tradeAmount);
    return NextResponse.redirect(`${paymentOrigin}${returnPath}?payment=${result.credited ? 'success' : 'pending'}`, 303);
  } catch (error) {
    console.error('ECPay topup result error:', error);
    return NextResponse.redirect(`${paymentOrigin}/?payment=pending`, 303);
  }
}
