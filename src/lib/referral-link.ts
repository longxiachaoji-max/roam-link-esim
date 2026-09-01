import { MIN_REFERRAL_CODE_LENGTH, normalizeReferralCode, referralCodeLength } from '@/lib/referral-code';

export const REFERRAL_STORAGE_KEY = 'firstroamlink-referral-code-v1';

export function validReferralCode(value: unknown) {
  const code = normalizeReferralCode(String(value || ''));
  return referralCodeLength(code) >= MIN_REFERRAL_CODE_LENGTH ? code : '';
}

export function rememberReferralCode(value: unknown) {
  const code = validReferralCode(value);
  if (!code || typeof window === 'undefined') return '';
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  return code;
}

export function readRememberedReferralCode() {
  if (typeof window === 'undefined') return '';
  return validReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
}

export function buildReferralShareUrl(code: unknown) {
  const normalized = validReferralCode(code);
  return normalized ? `https://firstesim.space/?ref=${encodeURIComponent(normalized)}` : '';
}
