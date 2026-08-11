import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { decryptEcpayBackgroundData } from '@/lib/ecpay-background-barcode';
import { markEcpayTopupPaid } from '@/lib/ecpay-topups';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const envelope = await request.json();
      const { merchantId, hashKey, hashIv } = getEcpayConfig();
      if (envelope?.MerchantID !== merchantId || envelope?.TransCode !== 1 || typeof envelope?.Data !== 'string') {
        throw new Error('綠界幕後取號回傳外層驗證失敗');
      }
      const result = decryptEcpayBackgroundData(envelope.Data, hashKey, hashIv);
      const tradeAmount = Number(result.OrderInfo?.TradeAmt);
      if (
        result.MerchantID === merchantId
        && result.RtnCode === 1
        && result.SimulatePaid !== 1
        && result.OrderInfo?.TradeStatus === '1'
        && result.OrderInfo?.PaymentType === 'BARCODE'
        && typeof result.CustomField === 'string'
        && /^[0-9a-f-]{36}$/i.test(result.CustomField)
        && Number.isFinite(tradeAmount)
      ) {
        await markEcpayTopupPaid(result.CustomField, tradeAmount);
      } else {
        throw new Error('綠界幕後取號付款資料驗證失敗');
      }
      return new Response('1|OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

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
