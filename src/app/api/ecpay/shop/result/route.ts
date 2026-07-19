import { NextResponse } from 'next/server';
import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { markPhysicalOrderPaid } from '@/lib/physical-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  try {
    const params = formDataToParams(await request.formData());
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const amount = Number(params.TradeAmt);
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);
    if (!verified || params.RtnCode !== '1' || params.SimulatePaid === '1' || !params.CustomField1 || !Number.isFinite(amount)) {
      return NextResponse.redirect(`${origin}/shop?payment=failed`, 303);
    }
    await markPhysicalOrderPaid(params.CustomField1, amount);
    return NextResponse.redirect(`${origin}/shop?payment=success`, 303);
  } catch (error) {
    console.error('Physical order ECPay result error:', error);
    return NextResponse.redirect(`${origin}/shop?payment=pending`, 303);
  }
}
