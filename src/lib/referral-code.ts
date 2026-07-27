export const MIN_REFERRAL_CODE_LENGTH = 2;
export const MAX_REFERRAL_CODE_LENGTH = 24;

export function normalizeReferralCode(value: string) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[^\p{Script=Han}A-Z0-9_-]/gu, '');

  return Array.from(normalized).slice(0, MAX_REFERRAL_CODE_LENGTH).join('');
}

export function referralCodeLength(value: string) {
  return Array.from(normalizeReferralCode(value)).length;
}
