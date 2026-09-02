import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateDealerCommissionAmount } from '../../src/lib/dealer-referral-math.ts';

test('percentage referral commission uses the customer paid amount', () => {
  assert.equal(calculateDealerCommissionAmount(970, 'percentage', 8, 1), 78);
});

test('fixed referral commission is paid per eSIM', () => {
  assert.equal(calculateDealerCommissionAmount(970, 'fixed', 25, 3), 75);
});

test('dealer referral tables are private and payout functions only allow service role', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20260902161822_dealer_referral_sales_mode.sql', import.meta.url), 'utf8');
  assert.match(migration, /dealer_referral_commissions enable row level security/i);
  assert.match(migration, /dealer_referral_payouts enable row level security/i);
  assert.match(migration, /revoke all[\s\S]+from public, anon, authenticated/i);
  assert.match(migration, /auth\.role\(\)\) <> 'service_role'/i);
  assert.match(migration, /unique references public\.orders\(id\)/i);
});

test('public checkout quote does not expose dealer commission settings', async () => {
  const route = await readFile(new URL('../../src/app/api/checkout/discount/route.ts', import.meta.url), 'utf8');
  const publicQuote = route.slice(route.indexOf('quote: {'), route.indexOf('quote: {') + 350);
  assert.doesNotMatch(publicQuote, /commissionMode|commissionValue|dealerId/);
});
