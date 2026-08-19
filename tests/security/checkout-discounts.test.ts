import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePromoDiscount } from '../../src/lib/promo-discount-math.ts';

test('calculates percentage and capped percentage checkout discounts', () => {
  assert.equal(calculatePromoDiscount(1000, 'percent', 10), 100);
  assert.equal(calculatePromoDiscount(1000, 'percent', 20, 120), 120);
});

test('applies a fixed discount once and keeps a positive payable total', () => {
  assert.equal(calculatePromoDiscount(900, 'fixed', 100), 100);
  assert.equal(calculatePromoDiscount(80, 'fixed', 100), 79);
});
