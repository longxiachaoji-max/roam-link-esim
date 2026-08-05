import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedReviewPurchase, parseProductReviewInput } from '../../src/lib/product-reviews.ts';

test('accepts complete review input and trims the comment', () => {
  assert.deepEqual(parseProductReviewInput({ rating: 5, smoothnessRating: 4, comment: '  日本使用順暢  ' }), {
    rating: 5,
    smoothnessRating: 4,
    comment: '日本使用順暢'
  });
});

test('rejects invalid ratings and empty comments', () => {
  assert.equal(parseProductReviewInput(null), null);
  assert.equal(parseProductReviewInput([]), null);
  assert.equal(parseProductReviewInput({ rating: 6, smoothnessRating: 4, comment: '很好' }), null);
  assert.equal(parseProductReviewInput({ rating: 5, smoothnessRating: 0, comment: '很好' }), null);
  assert.equal(parseProductReviewInput({ rating: 5, smoothnessRating: 4, comment: ' ' }), null);
});

test('only accepts a paid, completed purchase owned by the member', () => {
  const valid = { customerId: 'customer-a', orderCustomerId: 'customer-a', paymentStatus: 'PAID', orderStatus: 'COMPLETED', productId: 'product-a' };
  assert.equal(isVerifiedReviewPurchase(valid), true);
  assert.equal(isVerifiedReviewPurchase({ ...valid, orderCustomerId: 'customer-b' }), false);
  assert.equal(isVerifiedReviewPurchase({ ...valid, paymentStatus: 'PENDING' }), false);
  assert.equal(isVerifiedReviewPurchase({ ...valid, orderStatus: 'PENDING' }), false);
  assert.equal(isVerifiedReviewPurchase({ ...valid, productId: null }), false);
});
