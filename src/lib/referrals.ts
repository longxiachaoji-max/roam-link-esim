import type { SupabaseClient } from '@supabase/supabase-js';

const REFERRAL_PATTERN = /\n?<!--REFERRAL_CONFIG:([A-Za-z0-9+/=]+)-->\n?/;

export interface CustomerReferralRule {
  email: string;
  code: string;
  enabled: boolean;
  discountPercent: number;
  buyerRewardPercent: number;
  referrerRewardPercent: number;
  updatedAt?: string;
}

export interface PendingReferralReward {
  orderId: string;
  customerId: string;
  customerEmail: string;
  referrerEmail: string;
  code: string;
  originalTotal: number;
  discountAmount: number;
  paidTotal: number;
  buyerRewardPercent: number;
  referrerRewardPercent: number;
  createdAt: string;
  rewardedAt?: string;
}

export interface ReferralConfig {
  defaultDiscountPercent: number;
  defaultBuyerRewardPercent: number;
  defaultReferrerRewardPercent: number;
  customers: Record<string, CustomerReferralRule>;
  pendingRewards: Record<string, PendingReferralReward>;
}

export interface ReferralQuote {
  code: string;
  originalTotal: number;
  discountPercent: number;
  discountAmount: number;
  payableTotal: number;
  buyerRewardPercent: number;
  referrerRewardPercent: number;
  referrerEmail: string;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  defaultDiscountPercent: 3,
  defaultBuyerRewardPercent: 0,
  defaultReferrerRewardPercent: 3,
  customers: {},
  pendingRewards: {}
};

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
}

function clampPercent(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numberValue * 100) / 100));
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function normalizeConfig(config: Partial<ReferralConfig>): ReferralConfig {
  const defaults = DEFAULT_REFERRAL_CONFIG;
  const customers: ReferralConfig['customers'] = {};
  Object.entries(config.customers || {}).forEach(([email, rule]) => {
    const normalizedEmail = normalizeEmail(rule?.email || email);
    const code = normalizeReferralCode(rule?.code || '');
    if (!normalizedEmail || !code) return;
    customers[normalizedEmail] = {
      email: normalizedEmail,
      code,
      enabled: rule?.enabled !== false,
      discountPercent: clampPercent(rule?.discountPercent, clampPercent(config.defaultDiscountPercent, defaults.defaultDiscountPercent)),
      buyerRewardPercent: clampPercent(rule?.buyerRewardPercent, clampPercent(config.defaultBuyerRewardPercent, defaults.defaultBuyerRewardPercent)),
      referrerRewardPercent: clampPercent(rule?.referrerRewardPercent, clampPercent(config.defaultReferrerRewardPercent, defaults.defaultReferrerRewardPercent)),
      updatedAt: rule?.updatedAt
    };
  });

  return {
    defaultDiscountPercent: clampPercent(config.defaultDiscountPercent, defaults.defaultDiscountPercent),
    defaultBuyerRewardPercent: clampPercent(config.defaultBuyerRewardPercent, defaults.defaultBuyerRewardPercent),
    defaultReferrerRewardPercent: clampPercent(config.defaultReferrerRewardPercent, defaults.defaultReferrerRewardPercent),
    customers,
    pendingRewards: config.pendingRewards || {}
  };
}

export function parseReferralConfig(usageGuide: string | null): ReferralConfig {
  const match = (usageGuide || '').match(REFERRAL_PATTERN);
  if (!match?.[1]) return DEFAULT_REFERRAL_CONFIG;

  try {
    return normalizeConfig(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
  } catch {
    return DEFAULT_REFERRAL_CONFIG;
  }
}

export function withReferralConfig(usageGuide: string | null, config: ReferralConfig) {
  const cleanGuide = (usageGuide || '').replace(REFERRAL_PATTERN, '').trim();
  const encoded = Buffer.from(JSON.stringify(normalizeConfig(config)), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--REFERRAL_CONFIG:${encoded}-->`;
}

export async function readReferralConfig(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('site_settings')
    .select('usage_guide')
    .eq('id', 'main')
    .single();

  if (error) throw error;
  return {
    usageGuide: data?.usage_guide || '',
    config: parseReferralConfig(data?.usage_guide || '')
  };
}

export async function saveReferralConfig(supabase: SupabaseClient, usageGuide: string | null, config: ReferralConfig) {
  const { error } = await supabase
    .from('site_settings')
    .update({
      usage_guide: withReferralConfig(usageGuide || '', config),
      updated_at: new Date().toISOString()
    })
    .eq('id', 'main');

  if (error) throw error;
}

export function findReferralRuleByCode(config: ReferralConfig, code: string) {
  const normalizedCode = normalizeReferralCode(code);
  return Object.values(config.customers).find(rule => rule.enabled && rule.code === normalizedCode) || null;
}

export function ensureReferralCodeIsUnique(config: ReferralConfig, code: string, ownerEmail: string) {
  const normalizedCode = normalizeReferralCode(code);
  const normalizedOwner = normalizeEmail(ownerEmail);
  return !Object.values(config.customers).some(rule => (
    rule.code === normalizedCode && normalizeEmail(rule.email) !== normalizedOwner
  ));
}

export function buildReferralQuote(config: ReferralConfig, customerEmail: string, code: string, originalTotal: number): ReferralQuote {
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) throw new Error('請輸入折扣碼');
  if (!Number.isFinite(originalTotal) || originalTotal <= 0) throw new Error('訂單金額不正確');

  const rule = findReferralRuleByCode(config, normalizedCode);
  if (!rule) throw new Error('折扣碼不存在或尚未啟用');
  if (normalizeEmail(rule.email) === normalizeEmail(customerEmail)) {
    throw new Error('不可輸入自己的推薦碼');
  }

  const discountPercent = clampPercent(rule.discountPercent, config.defaultDiscountPercent);
  const discountAmount = Math.min(originalTotal, Math.round(originalTotal * discountPercent / 100));
  return {
    code: normalizedCode,
    originalTotal,
    discountPercent,
    discountAmount,
    payableTotal: Math.max(0, originalTotal - discountAmount),
    buyerRewardPercent: clampPercent(rule.buyerRewardPercent, config.defaultBuyerRewardPercent),
    referrerRewardPercent: clampPercent(rule.referrerRewardPercent, config.defaultReferrerRewardPercent),
    referrerEmail: normalizeEmail(rule.email)
  };
}

export async function awardReferralRewards(supabase: SupabaseClient, orderId: string) {
  const { usageGuide, config } = await readReferralConfig(supabase);
  const reward = config.pendingRewards[orderId];
  if (!reward || reward.rewardedAt) return { awarded: false };

  const buyerReward = Math.round(reward.paidTotal * reward.buyerRewardPercent / 100);
  const referrerReward = Math.round(reward.paidTotal * reward.referrerRewardPercent / 100);

  const { data: customer } = await supabase
    .from('customers')
    .select('id, token_balance')
    .eq('id', reward.customerId)
    .single();

  const { data: referrer } = await supabase
    .from('customers')
    .select('id, token_balance')
    .eq('email', reward.referrerEmail)
    .single();

  if (buyerReward > 0 && customer) {
    const nextBalance = Number(customer.token_balance || 0) + buyerReward;
    await supabase.from('customers').update({ token_balance: nextBalance }).eq('id', customer.id);
    await supabase.from('token_transactions').insert({
      customer_id: customer.id,
      amount: buyerReward,
      transaction_type: 'referral_reward',
      balance_after: nextBalance,
      reason: `折扣碼 ${reward.code} 結帳回饋`
    });
  }

  if (referrerReward > 0 && referrer) {
    const nextBalance = Number(referrer.token_balance || 0) + referrerReward;
    await supabase.from('customers').update({ token_balance: nextBalance }).eq('id', referrer.id);
    await supabase.from('token_transactions').insert({
      customer_id: referrer.id,
      amount: referrerReward,
      transaction_type: 'referral_reward',
      balance_after: nextBalance,
      reason: `推薦碼 ${reward.code} 訂單回饋`
    });
  }

  config.pendingRewards[orderId] = {
    ...reward,
    rewardedAt: new Date().toISOString()
  };
  await saveReferralConfig(supabase, usageGuide, config);
  return { awarded: true, buyerReward, referrerReward };
}
