import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { productRequiresKyc } from '../../src/lib/product-kyc.ts';

const planPage = readFileSync(new URL('../../src/app/esim/[slug]/plan/[id]/page.tsx', import.meta.url), 'utf8');
const dealerPage = readFileSync(new URL('../../src/app/dealer/page.tsx', import.meta.url), 'utf8');

test('detects explicit KYC requirements in product-facing text', () => {
  assert.equal(productRequiresKyc('日本 5GB', '需要實名認證 KYC'), true);
  assert.equal(productRequiresKyc('Taiwan eSIM', 'eKYC required before activation'), true);
  assert.equal(productRequiresKyc('Hong Kong eSIM', 'Identity verification is required'), true);
});

test('does not mislabel no-KYC or ordinary data plans', () => {
  assert.equal(productRequiresKyc('台灣短期 eSIM', '免 KYC、免實名與證件核驗'), false);
  assert.equal(productRequiresKyc('台灣 5GB', '不需實名認證'), false);
  assert.equal(productRequiresKyc('韓國 10GB', '支援熱點分享'), false);
});

test('shows the KYC badge beside carrier details in customer and dealer plan views', () => {
  assert.match(planPage, /productRequiresKyc/);
  assert.match(planPage, /電信業者[\s\S]*需實名認證/);
  assert.match(dealerPage, /productRequiresKyc/);
  assert.match(dealerPage, /電信業者：[\s\S]*需實名認證/);
});
