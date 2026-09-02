import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { normalizeDealerSalesMode } from '../../src/lib/dealer-sales-mode.ts';

test('dealer applicants can only request a supported cooperation mode', () => {
  assert.equal(normalizeDealerSalesMode('direct'), 'direct');
  assert.equal(normalizeDealerSalesMode('referral'), 'referral');
  assert.equal(normalizeDealerSalesMode('percentage_markup'), 'direct');
  assert.equal(normalizeDealerSalesMode({ referral: true }), 'direct');
});

test('registration stores only the requested mode and keeps commercial values admin-controlled', () => {
  const route = readFileSync(new URL('../../src/app/api/dealer/register/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../src/app/dealer/page.tsx', import.meta.url), 'utf8');

  assert.match(route, /sales_mode:\s*salesMode/);
  assert.doesNotMatch(route, /body\.referralCommission|body\.pricingValue|body\.referralDiscount/);
  assert.match(page, /經銷模式/);
  assert.match(page, /推薦碼模式/);
  assert.match(page, /由管理員審核並設定經銷價格或推薦分潤/);
});
