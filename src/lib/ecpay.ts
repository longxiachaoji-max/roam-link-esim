import { createHash, timingSafeEqual } from 'crypto';

export type EcpayParams = Record<string, string>;

export function getEcpayConfig() {
  const merchantId = process.env.ECPAY_MERCHANT_ID || '';
  const hashKey = process.env.ECPAY_HASH_KEY || '';
  const hashIv = process.env.ECPAY_HASH_IV || '';

  if (!merchantId || !hashKey || !hashIv) {
    throw new Error('綠界金流尚未完成設定');
  }

  return {
    merchantId,
    hashKey,
    hashIv,
    checkoutUrl: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
  };
}

function ecpayUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

export function generateCheckMacValue(params: EcpayParams, hashKey: string, hashIv: string) {
  const sorted = Object.entries(params)
    .filter(([key]) => key !== 'CheckMacValue')
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const body = sorted.map(([key, value]) => `${key}=${value}`).join('&');
  const encoded = ecpayUrlEncode(`HashKey=${hashKey}&${body}&HashIV=${hashIv}`);

  return createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

export function verifyCheckMacValue(params: EcpayParams, hashKey: string, hashIv: string) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const calculated = generateCheckMacValue(params, hashKey, hashIv);
  const receivedBuffer = Buffer.from(received, 'utf8');
  const calculatedBuffer = Buffer.from(calculated, 'utf8');

  return receivedBuffer.length === calculatedBuffer.length
    && timingSafeEqual(receivedBuffer, calculatedBuffer);
}

export function formDataToParams(formData: FormData): EcpayParams {
  const params: EcpayParams = {};
  for (const [key, value] of formData.entries()) {
    params[key] = typeof value === 'string' ? value : value.name;
  }
  return params;
}

export function createMerchantTradeNo() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RL${time}${random}`.slice(0, 20);
}

export function formatEcpayTradeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';

  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function sanitizeEcpayText(value: string, maxLength: number) {
  return value.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
