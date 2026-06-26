const PAYMENT_LIMITS_PATTERN = /\n?<!--PAYMENT_LIMITS:([\s\S]*?)-->\n?/;

export interface PaymentLimits {
  credit_min: number;
  credit_max: number;
  barcode_min: number;
  barcode_max: number;
}

export const DEFAULT_PAYMENT_LIMITS: PaymentLimits = {
  credit_min: 1,
  credit_max: 200000,
  barcode_min: 50,
  barcode_max: 20000
};

function toAmount(value: unknown, fallback: number) {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

export function normalizePaymentLimits(value: Partial<PaymentLimits> | null | undefined): PaymentLimits {
  const limits = {
    credit_min: toAmount(value?.credit_min, DEFAULT_PAYMENT_LIMITS.credit_min),
    credit_max: toAmount(value?.credit_max, DEFAULT_PAYMENT_LIMITS.credit_max),
    barcode_min: toAmount(value?.barcode_min, DEFAULT_PAYMENT_LIMITS.barcode_min),
    barcode_max: toAmount(value?.barcode_max, DEFAULT_PAYMENT_LIMITS.barcode_max)
  };

  if (limits.credit_max < limits.credit_min) limits.credit_max = limits.credit_min;
  if (limits.barcode_max < limits.barcode_min) limits.barcode_max = limits.barcode_min;
  return limits;
}

export function parsePaymentLimits(usageGuide: string | null | undefined): PaymentLimits {
  const match = (usageGuide || '').match(PAYMENT_LIMITS_PATTERN);
  if (!match?.[1]) return DEFAULT_PAYMENT_LIMITS;

  try {
    return normalizePaymentLimits(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
  } catch {
    return DEFAULT_PAYMENT_LIMITS;
  }
}

export function stripPaymentLimits(usageGuide: string | null | undefined) {
  return (usageGuide || '').replace(PAYMENT_LIMITS_PATTERN, '').trim();
}

export function withPaymentLimits(usageGuide: string | null | undefined, limits: PaymentLimits) {
  const cleanGuide = stripPaymentLimits(usageGuide);
  const encoded = Buffer.from(JSON.stringify(normalizePaymentLimits(limits)), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--PAYMENT_LIMITS:${encoded}-->`;
}
