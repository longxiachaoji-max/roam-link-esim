import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_REFERRAL_CODE_LENGTH,
  normalizeReferralCode,
  referralCodeLength
} from '../../src/lib/referral-code.ts';

test('keeps Traditional Chinese while removing unsupported characters', () => {
  assert.equal(normalizeReferralCode(' 一飛通 優惠！'), '一飛通優惠');
  assert.equal(referralCodeLength('一飛通'), 3);
});

test('normalizes full-width Latin characters and numbers before matching', () => {
  assert.equal(normalizeReferralCode('ｆｉｒｓｔ１２３'), 'FIRST123');
});

test('limits referral codes by Unicode characters', () => {
  assert.equal(
    referralCodeLength('漫'.repeat(MAX_REFERRAL_CODE_LENGTH + 5)),
    MAX_REFERRAL_CODE_LENGTH
  );
});

test('normalizes equivalent Chinese referral code input to the same value', () => {
  assert.equal(normalizeReferralCode('一 飛 通'), normalizeReferralCode('一飛通'));
});
