import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyDiscountLabel,
  companyNameMatches,
  isCompanyDiscountAvailable,
  normalizeCompanyName,
  type CompanyDiscountRow
} from '../../src/lib/company-discounts.ts';

const ACTIVE_COMPANY_DISCOUNT: CompanyDiscountRow = {
  code: 'ACME80',
  company_name: '範例旅行社股份有限公司',
  discount_type: 'percent',
  discount_value: 20,
  max_discount: null,
  min_order_amount: 0,
  max_uses: 100,
  used_count: 2,
  starts_at: '2026-01-01T00:00:00.000Z',
  expires_at: '2026-12-31T23:59:59.000Z'
};

test('normalizes punctuation, width and spacing in company names', () => {
  assert.equal(normalizeCompanyName(' 範例（旅行社） '), '範例旅行社');
  assert.equal(companyNameMatches('範例旅行社股份有限公司', '範例旅行社'), true);
  assert.equal(companyNameMatches('範例旅行社股份有限公司', '其他公司'), false);
});

test('requires a usable company discount before exposing its code', () => {
  const now = new Date('2026-08-20T00:00:00.000Z');
  assert.equal(isCompanyDiscountAvailable(ACTIVE_COMPANY_DISCOUNT, now), true);
  assert.equal(isCompanyDiscountAvailable({ ...ACTIVE_COMPANY_DISCOUNT, used_count: 100 }, now), false);
  assert.equal(isCompanyDiscountAvailable({ ...ACTIVE_COMPANY_DISCOUNT, expires_at: '2026-07-01T00:00:00.000Z' }, now), false);
});

test('formats enterprise percentage and fixed discounts for customers', () => {
  assert.equal(companyDiscountLabel(ACTIVE_COMPANY_DISCOUNT), '8 折');
  assert.equal(companyDiscountLabel({ ...ACTIVE_COMPANY_DISCOUNT, discount_type: 'fixed', discount_value: 120 }), '折抵 NT$120');
});
