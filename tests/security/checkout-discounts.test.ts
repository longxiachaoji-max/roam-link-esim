import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePromoDiscount,
  discountPercentToRate,
  discountRateToPercent
} from '../../src/lib/promo-discount-math.ts';

test('converts Taiwanese discount rates to internal discount percentages', () => {
  assert.equal(discountRateToPercent(8), 20);
  assert.equal(discountRateToPercent(7.5), 25);
  assert.equal(discountPercentToRate(30), 7);
});

test('calculates percentage and capped percentage checkout discounts', () => {
  assert.equal(calculatePromoDiscount(1000, 'percent', 10), 100);
  assert.equal(calculatePromoDiscount(1000, 'percent', 20, 120), 120);
});

test('applies a fixed discount once and keeps a positive payable total', () => {
  assert.equal(calculatePromoDiscount(900, 'fixed', 100), 100);
  assert.equal(calculatePromoDiscount(80, 'fixed', 100), 79);
});
