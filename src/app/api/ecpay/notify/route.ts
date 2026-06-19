import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { markEcpayOrderPaidAndFulfill } from '@/lib/ecpay-orders';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const params = formDataToParams(await request.formData());
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);

    if (!verified) {
      console.error('ECPay callback verification failed', { merchantTradeNo: params.MerchantTradeNo });
      return new Response('1|OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const tradeAmount = Number(params.TradeAmt);
    if (params.RtnCode === '1' && params.SimulatePaid !== '1' && params.CustomField1 && Number.isFinite(tradeAmount)) {
      await markEcpayOrderPaidAndFulfill(params.CustomField1, tradeAmount);
    } else {
      console.warn('ECPay payment was not fulfilled', {
        merchantTradeNo: params.MerchantTradeNo,
        rtnCode: params.RtnCode,
        simulatePaid: params.SimulatePaid
      });
    }
  } catch (error) {
    console.error('ECPay callback error:', error);
  }

  return new Response('1|OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
