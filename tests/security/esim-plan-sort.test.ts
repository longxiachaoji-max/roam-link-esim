import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareEsimPlanOrder,
  getEsimPlanSortKey
} from '../../src/lib/esim-plan-sort.ts';

test('sorts eSIM plans by the storefront category rule', () => {
  const plans = [
    '總量50GB',
    '每日1GB',
    '吃到飽，最高速率10mbps',
    '每日10GB',
    '本地網路KDDI 吃到飽',
    '總量5GB'
  ];

  assert.deepEqual([...plans].sort(compareEsimPlanOrder), [
    '本地網路KDDI 吃到飽',
    '吃到飽，最高速率10mbps',
    '每日10GB',
    '每日1GB',
    '總量50GB',
    '總量5GB'
  ]);
});

test('normalizes MB and GB before sorting usage from high to low', () => {
  assert.deepEqual(
    ['每日500MB', '每日2GB', '每日1GB'].sort(compareEsimPlanOrder),
    ['每日2GB', '每日1GB', '每日500MB']
  );
});

test('distinguishes unrestricted and speed-limited unlimited plans', () => {
  assert.equal(getEsimPlanSortKey('不限速上網吃到飽').type, 'unlimited');
  assert.equal(getEsimPlanSortKey('吃到飽，最高速率10Mbps').type, 'speed-limited-unlimited');
  assert.equal(getEsimPlanSortKey('每日1GB用畢降速128kbps').type, 'daily');
});
