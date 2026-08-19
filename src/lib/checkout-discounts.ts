import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeReferralCode } from '@/lib/referral-code';
import { buildReferralQuote, readReferralConfig, type ReferralQuote } from '@/lib/referrals';
import { calculatePromoDiscount } from '@/lib/promo-discount-math';

type DiscountType = 'percent' | 'fixed';
type AudienceType = 'public' | 'personal' | 'company';

interface CheckoutPromoRow {
  id: string;
  code: string;
  name: string | null;
  reward_type: string | null;
  discount_type: DiscountType | null;
  discount_value: number | string | null;
  max_discount: number | string | null;
  min_order_amount: number | string | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  used_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  audience_type: AudienceType | null;
  assigned_email: string | null;
  company_name: string | null;
  allowed_email_domain: string | null;
}

export interface PromoDiscountQuote {
  source: 'promo';
  promoCodeId: string;
  code: string;
  label: string;
  originalTotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  payableTotal: number;
}

export type CheckoutDiscountQuote = PromoDiscountQuote | (ReferralQuote & { source: 'referral'; label: string });

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function positiveNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function promoError(message: string): never {
  throw new Error(message);
}

async function buildPromoQuote(
  supabase: SupabaseClient,
  promo: CheckoutPromoRow,
  customerEmail: string,
  originalTotal: number
): Promise<PromoDiscountQuote> {
  if (promo.reward_type !== 'discount') {
    promoError('此代碼為儲值金兌換碼，請到會員中心使用');
  }
  if (!promo.is_active) promoError('此優惠碼目前未啟用');

  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) promoError('此優惠碼尚未開始');
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now) promoError('此優惠碼已過期');
  if (Number(promo.used_count || 0) >= Number(promo.max_uses || 1)) promoError('此優惠碼已達使用上限');

  const minOrderAmount = positiveNumber(promo.min_order_amount);
  if (originalTotal < minOrderAmount) promoError(`此優惠碼需消費滿 NT$${Math.round(minOrderAmount).toLocaleString()}`);

  const email = normalizeEmail(customerEmail);
  if (promo.audience_type === 'personal' && normalizeEmail(promo.assigned_email || '') !== email) {
    promoError('此優惠碼僅限指定會員使用');
  }
  const domain = String(promo.allowed_email_domain || '').trim().toLowerCase().replace(/^@/, '');
  if (promo.audience_type === 'company' && domain && email.split('@')[1] !== domain) {
    promoError('此優惠碼僅限指定企業會員使用');
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (customer?.id) {
    const { count, error } = await supabase
      .from('promo_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('promo_code_id', promo.id);
    if (error) throw error;
    if (Number(count || 0) >= Number(promo.max_uses_per_user || 1)) {
      promoError(`每位會員限用 ${Number(promo.max_uses_per_user || 1)} 次`);
    }
  }

  const discountType = promo.discount_type;
  const discountValue = positiveNumber(promo.discount_value);
  if (!discountType || !discountValue) promoError('此優惠碼的折扣設定不完整');

  const maxDiscount = positiveNumber(promo.max_discount);
  const discountAmount = calculatePromoDiscount(originalTotal, discountType, discountValue, maxDiscount);
  if (discountAmount <= 0) promoError('此訂單金額無法套用該優惠碼');

  return {
    source: 'promo',
    promoCodeId: promo.id,
    code: normalizeReferralCode(promo.code),
    label: promo.name || (promo.audience_type === 'company' ? promo.company_name || '企業優惠' : '活動優惠'),
    originalTotal,
    discountType,
    discountValue,
    discountAmount,
    payableTotal: originalTotal - discountAmount
  };
}

export async function resolveCheckoutDiscount(
  supabase: SupabaseClient,
  customerEmail: string,
  rawCode: string,
  originalTotal: number
): Promise<CheckoutDiscountQuote> {
  const code = normalizeReferralCode(rawCode);
  if (!code) throw new Error('請輸入折扣碼');
  if (!Number.isFinite(originalTotal) || originalTotal <= 0) throw new Error('訂單金額不正確');

  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('id, code, name, reward_type, discount_type, discount_value, max_discount, min_order_amount, max_uses, max_uses_per_user, used_count, starts_at, expires_at, is_active, audience_type, assigned_email, company_name, allowed_email_domain')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (promo) return buildPromoQuote(supabase, promo as CheckoutPromoRow, customerEmail, originalTotal);

  const { config } = await readReferralConfig(supabase);
  const referral = buildReferralQuote(config, customerEmail, code, originalTotal);
  return { ...referral, source: 'referral', label: '會員推薦優惠' };
}

export function isPromoDiscount(quote: CheckoutDiscountQuote | null): quote is PromoDiscountQuote {
  return quote?.source === 'promo';
}
