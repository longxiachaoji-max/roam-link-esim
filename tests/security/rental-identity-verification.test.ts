import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkoutRoute = readFileSync('src/app/api/shop/checkout/route.ts', 'utf8');
const identityRoute = readFileSync('src/app/api/member/identity-verification/route.ts', 'utf8');
const adminRoute = readFileSync('src/app/api/admin/identity-verifications/route.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260904102541_add_member_identity_verification.sql', 'utf8');
const pickupConfirmationMigration = readFileSync('supabase/migrations/20260904235500_confirm_pickup_before_reserving_dates.sql', 'utf8');
const identityComponent = readFileSync('src/components/identity-verification.tsx', 'utf8');

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
  assert.match(identityRoute, /prepareIdentityImage\(file, kind !== 'selfie'\)/);
  const memberGetHandler = identityRoute.slice(identityRoute.indexOf('export async function GET'), identityRoute.indexOf('export async function POST'));
  assert.doesNotMatch(memberGetHandler, /id_front_path|id_back_path|selfie_path/);
});

test('cash pickup requests do not reserve rental dates until an admin confirms them', () => {
  assert.match(pickupConfirmationMigration, /new\.order_status := 'PENDING_CONFIRMATION'/);
  assert.match(pickupConfirmationMigration, /new\.reservation_expires_at := null/);
  assert.match(pickupConfirmationMigration, /confirm_physical_pickup_reservation/);
  assert.match(pickupConfirmationMigration, /order_status = 'PROCESSING'/);
});

test('identity photos are compressed before the authenticated upload', () => {
  assert.match(identityComponent, /MAX_UPLOAD_BYTES = 750_000/);
  assert.match(identityComponent, /compressIdentityPhoto/);
  assert.match(identityComponent, /canvas\.toBlob/);
  assert.match(identityComponent, /Promise\.allSettled\(\[/);
  assert.match(identityRoute, /form\.get\('file'\)/);
  assert.match(identityRoute, /export async function PUT/);
});

test('members can preview selected identity photos and the ID watermark', () => {
  assert.match(identityComponent, /URL\.createObjectURL\(file\)/);
  assert.match(identityComponent, /alt={`\$\{label\}預覽`}/);
  assert.match(identityComponent, /僅供一飛通租借實名認證使用/);
  assert.match(identityComponent, /previewUrl && !selfieCapture/);
});
