import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeSupplierTopupInput,
  parseSupplierTopups,
  rateOf,
  summarizeSupplierTopups,
  withSupplierTopups,
  type SupplierTopup
} from '../src/lib/supplier-topups.ts';

const record = (overrides: Partial<SupplierTopup>): SupplierTopup => ({
  id: 'r1', date: '2026-10-23', twd: 1000, usd: 27.83, balanceAfterUsd: null, note: '', createdAt: '2026-10-23T08:00:00.000Z',
  ...overrides
});

test('computes the TWD per USD rate', () => {
  assert.equal(rateOf({ twd: 1000, usd: 27.83 })?.toFixed(2), '35.93');
});

test('validates input', () => {
  assert.deepEqual(
    normalizeSupplierTopupInput({ date: '2026-10-23', twd: '1000', usd: '27.83', balanceAfterUsd: '', note: ' 街口轉帳 ' }),
    { date: '2026-10-23', twd: 1000, usd: 27.83, balanceAfterUsd: null, note: '街口轉帳' }
  );
  assert.throws(() => normalizeSupplierTopupInput({ date: '', twd: 1000, usd: 27 }), /日期/);
  assert.throws(() => normalizeSupplierTopupInput({ date: '2026-10-23', twd: 0, usd: 27 }), /台幣/);
  assert.throws(() => normalizeSupplierTopupInput({ date: '2026-10-23', twd: 1000, usd: '' }), /美金/);
});

test('stores records without touching other hidden settings', () => {
  const guide = '使用說明\n\n<!--PAYMENT_LIMITS:abc-->';
  const stored = withSupplierTopups(guide, [record({})]);
  assert.ok(stored.includes('<!--PAYMENT_LIMITS:abc-->'));
  assert.equal(parseSupplierTopups(stored)[0].usd, 27.83);

  const replaced = withSupplierTopups(stored, [record({ id: 'r2', usd: 30 })]);
  assert.equal(parseSupplierTopups(replaced).length, 1);
  assert.equal((replaced.match(/SUPPLIER_TOPUPS/g) || []).length, 1);
});

test('summarizes totals, average and latest balance', () => {
  const summary = summarizeSupplierTopups([
    record({ id: 'a', date: '2026-10-01', twd: 3000, usd: 90, balanceAfterUsd: 120 }),
    record({ id: 'b', date: '2026-10-23', twd: 1000, usd: 27.83 })
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalTwd, 4000);
  assert.equal(summary.totalUsd, 117.83);
  assert.equal(summary.averageRate?.toFixed(2), '33.95');
  assert.equal(summary.latestRate?.toFixed(2), '35.93');
  assert.equal(summary.latestBalanceUsd, 120);
  assert.equal(summary.latestBalanceDate, '2026-10-01');
});
