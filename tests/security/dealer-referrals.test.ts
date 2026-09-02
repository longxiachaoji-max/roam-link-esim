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

test('dealer percentage commission is calculated from retail price before customer discount', async () => {
  const source = await readFile(new URL('../../src/lib/dealer-referrals.ts', import.meta.url), 'utf8');
  assert.match(source, /calculateDealerCommissionAmount\(quote\.originalTotal/);
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

test('dealers can own multiple private referral codes with payouts separated by code', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20260903100000_dealer_multiple_referral_codes.sql', import.meta.url), 'utf8');
  const referralRoute = await readFile(new URL('../../src/app/api/dealer/referrals/route.ts', import.meta.url), 'utf8');
  const checkout = await readFile(new URL('../../src/lib/dealer-referrals.ts', import.meta.url), 'utf8');

  assert.match(migration, /create table if not exists public\.dealer_referral_codes/i);
  assert.match(migration, /dealer_referral_codes enable row level security/i);
  assert.match(migration, /unique index[\s\S]+dealer_id, coalesce\(upper\(code_snapshot\)/i);
  assert.match(migration, /upper\(code_snapshot\) = v_code and status = 'available'/i);
  assert.match(referralRoute, /action === 'createCode'/);
  assert.match(referralRoute, /p_code: code/);
  assert.match(checkout, /from\('dealer_referral_codes'\)/);
});

test('admin share is capped at 30 percent and each code controls its customer/owner split', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20260903103000_dealer_referral_share_split.sql', import.meta.url), 'utf8');
  const route = await readFile(new URL('../../src/app/api/dealer/referrals/route.ts', import.meta.url), 'utf8');
  const adminPage = await readFile(new URL('../../src/app/admin/dealers/page.tsx', import.meta.url), 'utf8');
  assert.match(migration, /referral_share_percent >= 0 and referral_share_percent <= 30/i);
  assert.match(migration, /customer_discount_percent \+ owner_commission_percent <= 30/i);
  assert.match(route, /customerDiscountPercent \+ ownerCommissionPercent > allowedShare/);
  assert.match(route, /action === 'updateCodeSettings'/);
  assert.match(adminPage, /可分配總比例（最高 30%）/);
  assert.doesNotMatch(adminPage, /客戶結帳折扣（%）/);
});
