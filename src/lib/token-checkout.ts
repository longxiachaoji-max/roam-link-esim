const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TokenCheckoutRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCheckoutRequestError';
  }
}

export function parseTokenCheckoutRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TokenCheckoutRequestError('結帳資料格式不正確');
  }

  const body = value as Record<string, unknown>;
  if (body.paymentMethod !== 'TOKENS') {
    throw new TokenCheckoutRequestError('此結帳端點僅支援儲值金付款');
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!UUID_PATTERN.test(productId)) {
    throw new TokenCheckoutRequestError('商品資料不正確');
  }

  return {
    productId,
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '',
    discountCode: typeof body.discountCode === 'string' ? body.discountCode.trim().slice(0, 64) : ''
  };
}
