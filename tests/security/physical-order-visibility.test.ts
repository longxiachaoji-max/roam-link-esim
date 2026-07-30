import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canMemberDeletePhysicalOrder,
  getPhysicalOrderDeleteHidesAt,
  getPhysicalOrderRentalHistoryExpiresAt,
  isPhysicalOrderVisibleToMember
} from '../../src/lib/physical-order-visibility.ts';

const HOUR = 60 * 60 * 1000;

test('keeps a member-deleted physical order visible for 24 hours', () => {
  const deletedAt = '2026-07-30T04:00:00.000Z';
  const hidesAt = getPhysicalOrderDeleteHidesAt(deletedAt);

  assert.equal(hidesAt, new Date(deletedAt).getTime() + 24 * HOUR);
  assert.equal(isPhysicalOrderVisibleToMember({ user_deleted_at: deletedAt }, new Date(deletedAt).getTime() + 23 * HOUR), true);
  assert.equal(isPhysicalOrderVisibleToMember({ user_deleted_at: deletedAt }, new Date(deletedAt).getTime() + 24 * HOUR), false);
});

test('keeps an undeleted rental order for six calendar months after its latest rental end date', () => {
  const order = {
    physical_order_items: [
      { rental_end_date: '2026-07-20' },
      { rental_end_date: '2026-07-25' }
    ]
  };

  assert.equal(
    getPhysicalOrderRentalHistoryExpiresAt(order.physical_order_items),
    Date.UTC(2027, 0, 24, 16)
  );
  assert.equal(isPhysicalOrderVisibleToMember(order, Date.UTC(2027, 0, 24, 15, 59)), true);
  assert.equal(isPhysicalOrderVisibleToMember(order, Date.UTC(2027, 0, 24, 16)), false);
});

test('clamps month-end rental retention and keeps non-rental orders visible', () => {
  assert.equal(
    getPhysicalOrderRentalHistoryExpiresAt([{ rental_end_date: '2026-08-31' }]),
    Date.UTC(2027, 1, 27, 16)
  );
  assert.equal(isPhysicalOrderVisibleToMember({ physical_order_items: [{ rental_end_date: null }] }, Date.UTC(2030, 0, 1)), true);
});

test('only allows completed, non-deleted orders to be deleted by a member', () => {
  assert.equal(canMemberDeletePhysicalOrder('COMPLETED', null), true);
  assert.equal(canMemberDeletePhysicalOrder('PROCESSING', null), false);
  assert.equal(canMemberDeletePhysicalOrder('SHIPPED', null), false);
  assert.equal(canMemberDeletePhysicalOrder('CANCELLED', null), false);
  assert.equal(canMemberDeletePhysicalOrder('COMPLETED', '2026-07-30T04:00:00.000Z'), false);
});
