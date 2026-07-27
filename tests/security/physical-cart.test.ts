import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePhysicalCartSnapshots,
  normalizePhysicalCartSnapshot
} from '../../src/lib/physical-cart.ts';

const PRODUCT_A = '11111111-1111-4111-8111-111111111111';
const PRODUCT_B = '22222222-2222-4222-8222-222222222222';

test('normalizes legacy browser cart items without trusting product details', () => {
  assert.deepEqual(normalizePhysicalCartSnapshot([{
    id: PRODUCT_A,
    name: '<script>ignored</script>',
    price: 1,
    quantity: 2
  }]), [{
    productId: PRODUCT_A,
    quantity: 2
  }]);
});

test('keeps rental dates and enforces a single rental quantity', () => {
  assert.deepEqual(normalizePhysicalCartSnapshot([{
    productId: PRODUCT_A,
    quantity: 9,
    rentalStartDate: '2026-08-01',
    rentalEndDate: '2026-08-05'
  }]), [{
    productId: PRODUCT_A,
    quantity: 1,
    rentalStartDate: '2026-08-01',
    rentalEndDate: '2026-08-05'
  }]);
});

test('merges device and cloud carts without duplicating the same item', () => {
  assert.deepEqual(mergePhysicalCartSnapshots(
    [{ productId: PRODUCT_A, quantity: 1 }],
    [{ productId: PRODUCT_A, quantity: 3 }, { productId: PRODUCT_B, quantity: 1 }]
  ), [
    { productId: PRODUCT_A, quantity: 3 },
    { productId: PRODUCT_B, quantity: 1 }
  ]);
});

test('rejects malformed ids, quantities, and partial rental dates', () => {
  assert.deepEqual(normalizePhysicalCartSnapshot([
    { productId: 'not-a-uuid', quantity: 1 },
    { productId: PRODUCT_A, quantity: 0 },
    { productId: PRODUCT_B, quantity: 1, rentalStartDate: '2026-08-01' }
  ]), []);
});
