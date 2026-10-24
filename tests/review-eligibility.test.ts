import assert from 'node:assert/strict';
import test from 'node:test';
import { canReviewEsim, hasEsimUsage } from '../src/lib/review-eligibility.ts';

test('detects real usage', () => {
  assert.equal(hasEsimUsage(null), false);
  assert.equal(hasEsimUsage({ status: '尚未安裝', usedData: null }), false);
  assert.equal(hasEsimUsage({ status: '已安裝', usedData: '0' }), false);
  assert.equal(hasEsimUsage({ status: '已安裝', usedData: '0.00 MB' }), false);
  assert.equal(hasEsimUsage({ status: '已安裝', usedData: '12.5 MB' }), true);
  assert.equal(hasEsimUsage({ status: '已啟用' }), true);
  assert.equal(hasEsimUsage({ status: '已到期' }), true);
  assert.equal(hasEsimUsage({ status: '已下載', activatedAt: '2026-10-23T10:00:00Z' }), true);
});

test('allows review with usage, admin unlock, or an existing review', () => {
  assert.equal(canReviewEsim({ hasExistingReview: false, reviewUnlockedAt: null, usage: null }), false);
  assert.equal(canReviewEsim({ hasExistingReview: false, reviewUnlockedAt: '2026-10-24T00:00:00Z', usage: null }), true);
  assert.equal(canReviewEsim({ hasExistingReview: true, reviewUnlockedAt: null, usage: null }), true);
  assert.equal(canReviewEsim({ hasExistingReview: false, reviewUnlockedAt: null, usage: { status: '已啟用' } }), true);
});
