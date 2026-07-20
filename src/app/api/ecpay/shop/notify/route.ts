import { formDataToParams, getEcpayConfig, verifyCheckMacValue } from '@/lib/ecpay';
import { getPhysicalStoreAdmin, markPhysicalOrderPaid } from '@/lib/physical-store';
import { sendPhysicalRentalOrderCreatedAlert } from '@/lib/physical-rental-alerts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const params = formDataToParams(await request.formData());
    const { merchantId, hashKey, hashIv } = getEcpayConfig();
    const verified = params.MerchantID === merchantId && verifyCheckMacValue(params, hashKey, hashIv);
    const amount = Number(params.TradeAmt);
    if (verified && params.RtnCode === '1' && params.SimulatePaid !== '1' && params.CustomField1 && Number.isFinite(amount)) {
      await markPhysicalOrderPaid(params.CustomField1, amount);
      await sendPhysicalRentalOrderCreatedAlert(getPhysicalStoreAdmin(), params.CustomField1);
    }
  } catch (error) {
    console.error('Physical order ECPay callback error:', error);
  }
  return new Response('1|OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
