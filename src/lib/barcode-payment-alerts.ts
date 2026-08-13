import type { SupabaseLike } from '@/lib/order-alerts';
import {
  escapeTelegramHtml,
  getTelegramNotificationSettings,
  sendTelegramMessage
} from '@/lib/order-alerts';

interface BarcodePaymentAlert {
  orderId: string;
  orderNumber?: string | null;
  customerEmail: string;
  amount: number;
  purpose: string;
  itemNames?: string[];
  merchantTradeNo?: string | null;
}

function formatAmount(amount: number) {
  return `NT$${Math.round(Number(amount) || 0).toLocaleString('zh-TW')}`;
}

function getAdminUrl() {
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space'}/admin/barcode-orders`;
}

function buildOrderLines(alert: BarcodePaymentAlert) {
  const orderReference = alert.orderNumber || alert.orderId;
  const itemNames = (alert.itemNames || []).filter(Boolean).join('、');

  return [
    `用途：${escapeTelegramHtml(alert.purpose)}`,
    `訂單：<code>${escapeTelegramHtml(orderReference)}</code>`,
    `客戶：${escapeTelegramHtml(alert.customerEmail)}`,
    `金額：${escapeTelegramHtml(formatAmount(alert.amount))}`,
    itemNames ? `內容：${escapeTelegramHtml(itemNames)}` : '',
    alert.merchantTradeNo ? `綠界編號：<code>${escapeTelegramHtml(alert.merchantTradeNo)}</code>` : ''
  ].filter(Boolean);
}

export async function sendBarcodePaymentCreatedAlert(
  supabase: SupabaseLike,
  alert: BarcodePaymentAlert
) {
  const settings = await getTelegramNotificationSettings(supabase);
  return sendTelegramMessage(settings, [
    '<b>新的超商付款訂單</b>',
    ...buildOrderLines(alert),
    '狀態：等待客戶繳款',
    `後台：${getAdminUrl()}`
  ], 'Failed to send barcode payment Telegram alert');
}

export async function sendBarcodeReceiptUploadedAlert(
  supabase: SupabaseLike,
  alert: BarcodePaymentAlert
) {
  const settings = await getTelegramNotificationSettings(supabase);
  return sendTelegramMessage(settings, [
    '<b>客戶已上傳超商繳款收據</b>',
    ...buildOrderLines(alert),
    '狀態：等待人工審核確認',
    `後台：${getAdminUrl()}`
  ], 'Failed to send barcode receipt Telegram alert');
}
