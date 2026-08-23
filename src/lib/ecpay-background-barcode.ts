import { createCipheriv, createDecipheriv } from 'crypto';
import { formatEcpayTradeDate, getEcpayConfig } from '@/lib/ecpay';

interface EcpayEnvelope {
  MerchantID?: string;
  TransCode?: number;
  TransMsg?: string;
  Data?: string;
}

export interface EcpayBackgroundCallback {
  RtnCode?: number;
  RtnMsg?: string;
  MerchantID?: string;
  SimulatePaid?: number;
  OrderInfo?: {
    MerchantTradeNo?: string;
    TradeNo?: string;
    TradeAmt?: number;
    PaymentType?: string;
    TradeStatus?: string;
  };
  BarcodeInfo?: {
    Barcode1?: string;
    Barcode2?: string;
    Barcode3?: string;
    ExpireDate?: string;
  };
  CustomField?: string;
}

function encryptData(value: unknown, hashKey: string, hashIv: string) {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'));
  return cipher.update(encodeURIComponent(JSON.stringify(value)), 'utf8', 'base64') + cipher.final('base64');
}

export function decryptEcpayBackgroundData(value: string, hashKey: string, hashIv: string) {
  const decipher = createDecipheriv('aes-128-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'));
  const encoded = decipher.update(value, 'base64', 'utf8') + decipher.final('utf8');
  return JSON.parse(decodeURIComponent(encoded)) as EcpayBackgroundCallback;
}

function normalizeBarcode(value: unknown) {
  const barcode = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(barcode)) throw new Error('綠界回傳的超商條碼格式不正確');
  return barcode;
}

function parseEcpayDate(value: unknown) {
  const normalized = String(value || '').trim().replace(/\+/g, ' ');
  const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error('綠界回傳的條碼期限格式不正確');
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
}

export async function createEcpayBackgroundBarcode(options: {
  merchantTradeNo: string;
  amount: number;
  returnUrl: string;
  orderId: string;
  expireDays?: number;
  tradeDesc?: string;
  itemName?: string;
}) {
  const { merchantId, hashKey, hashIv } = getEcpayConfig();
  const requestData = {
    MerchantID: merchantId,
    ChoosePayment: 'BARCODE',
    OrderInfo: {
      MerchantTradeNo: options.merchantTradeNo,
      MerchantTradeDate: formatEcpayTradeDate(),
      TotalAmount: options.amount,
      ReturnURL: options.returnUrl,
      TradeDesc: options.tradeDesc || 'FirstRoamLink payment',
      ItemName: options.itemName || '一飛通儲值金'
    },
    BarcodeInfo: { ExpireDate: options.expireDays || 3 },
    CustomField: options.orderId
  };
  const response = await fetch('https://ecpayment.ecpay.com.tw/1.0.0/Cashier/GenPaymentCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      MerchantID: merchantId,
      RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
      Data: encryptData(requestData, hashKey, hashIv)
    }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`綠界超商條碼服務暫時無法使用 (${response.status})`);

  const envelope = await response.json() as EcpayEnvelope;
  if (envelope.MerchantID !== merchantId || envelope.TransCode !== 1 || !envelope.Data) {
    throw new Error(envelope.TransMsg || '綠界無法建立超商條碼');
  }
  const result = decryptEcpayBackgroundData(envelope.Data, hashKey, hashIv);
  const orderInfo = result.OrderInfo;
  const barcodeInfo = result.BarcodeInfo;
  if (
    result.RtnCode !== 1
    || result.MerchantID !== merchantId
    || orderInfo?.MerchantTradeNo !== options.merchantTradeNo
    || Number(orderInfo?.TradeAmt) !== options.amount
    || orderInfo?.PaymentType !== 'BARCODE'
    || !barcodeInfo
  ) {
    throw new Error(result.RtnMsg || '綠界無法建立超商條碼');
  }

  return {
    tradeNo: String(orderInfo.TradeNo || '').trim(),
    barcode1: normalizeBarcode(barcodeInfo.Barcode1),
    barcode2: normalizeBarcode(barcodeInfo.Barcode2),
    barcode3: normalizeBarcode(barcodeInfo.Barcode3),
    expiresAt: parseEcpayDate(barcodeInfo.ExpireDate)
  };
}
