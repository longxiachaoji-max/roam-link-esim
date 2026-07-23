import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseTokenCheckoutRequest,
  TokenCheckoutRequestError
} from '../../src/lib/token-checkout.ts';

const PRODUCT_ID = '49df60d8-3255-4eb2-8a7d-4f1d9396caf7';

test('accepts the dedicated token payment method', () => {
  assert.deepEqual(parseTokenCheckoutRequest({
    paymentMethod: 'TOKENS',
    productId: PRODUCT_ID,
    name: '  Test User  ',
    discountCode: ' SUMMER '
  }), {
    productId: PRODUCT_ID,
    name: 'Test User',
    discountCode: 'SUMMER'
  });
});

test('rejects the legacy mixed-payment bypass', () => {
  assert.throws(() => parseTokenCheckoutRequest({
    paymentMethod: 'CREDIT_CARD',
    productId: PRODUCT_ID,
    useTokens: true
  }), TokenCheckoutRequestError);
});

test('rejects a missing or malformed product id', () => {
  assert.throws(() => parseTokenCheckoutRequest({
    paymentMethod: 'TOKENS',
    productId: 'not-a-product-id'
  }), TokenCheckoutRequestError);
});
