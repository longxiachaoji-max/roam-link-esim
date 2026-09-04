import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkoutRoute = readFileSync('src/app/api/shop/checkout/route.ts', 'utf8');
const identityRoute = readFileSync('src/app/api/member/identity-verification/route.ts', 'utf8');
const adminRoute = readFileSync('src/app/api/admin/identity-verifications/route.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260904102541_add_member_identity_verification.sql', 'utf8');

test('rental checkout is enforced server-side', () => {
  assert.match(checkoutRoute, /verification\?\.status !== 'APPROVED'/);
  assert.match(checkoutRoute, /body\.rentalTermsAccepted !== true/);
  assert.match(checkoutRoute, /paymentMethod === 'CASH_PICKUP'.*deliveryMethod !== 'pickup'/s);
});

test('identity documents stay in private storage and use privileged APIs', () => {
  assert.match(migration, /'identity-verifications'[\s\S]*false/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.customer_identity_verifications from anon, authenticated/);
  assert.match(identityRoute, /requireAuthenticatedUser/);
  assert.match(adminRoute, /requireAdminUser/);
  assert.match(adminRoute, /createSignedUrls/);
});

test('server watermarks ID images and never returns storage paths to members', () => {
  assert.match(identityRoute, /prepareIdentityImage\(idFront, true\)/);
  assert.match(identityRoute, /prepareIdentityImage\(idBack, true\)/);
  const memberGetHandler = identityRoute.slice(identityRoute.indexOf('export async function GET'), identityRoute.indexOf('export async function POST'));
  assert.doesNotMatch(memberGetHandler, /id_front_path|id_back_path|selfie_path/);
});
