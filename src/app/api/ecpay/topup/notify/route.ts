import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { markEcpayTopupPaid } from '@/lib/ecpay-topups';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const params = formDataToParams(await request.formData());
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);
    const tradeAmount = Number(params.TradeAmt);

    if (verified && params.RtnCode === '1' && params.SimulatePaid !== '1' && params.CustomField2 === 'TOPUP' && params.CustomField1 && Number.isFinite(tradeAmount)) {
      await markEcpayTopupPaid(params.CustomField1, tradeAmount);
    } else if (!verified) {
      console.error('ECPay topup callback verification failed', { merchantTradeNo: params.MerchantTradeNo });
    }
  } catch (error) {
    console.error('ECPay topup callback error:', error);
  }

  return new Response('1|OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
