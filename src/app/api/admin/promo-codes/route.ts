import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeReferralCode, referralCodeLength, MIN_REFERRAL_CODE_LENGTH } from '@/lib/referral-code';
import { findReferralRuleByCode, readReferralConfig } from '@/lib/referrals';
import { adminApiGuard } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type RewardType = 'discount' | 'tokens';
type DiscountType = 'percent' | 'fixed';
type AudienceType = 'public' | 'personal' | 'company';

interface PromoPayload {
  code?: unknown;
  name?: unknown;
  reward_type?: unknown;
  reward_tokens?: unknown;
  discount_type?: unknown;
  discount_value?: unknown;
  max_discount?: unknown;
  min_order_amount?: unknown;
  max_uses?: unknown;
  max_uses_per_user?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
  is_active?: unknown;
  audience_type?: unknown;
  assigned_email?: unknown;
  company_name?: unknown;
}

interface PromoMutation {
  code: string;
  name: string | null;
  reward_type: RewardType;
  reward_tokens: number;
  discount_type: DiscountType | null;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  max_uses: number;
  max_uses_per_user: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  audience_type: AudienceType;
  assigned_email: string | null;
  company_name: string | null;
  allowed_email_domain: string | null;
  updated_at: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key);
}

function integer(value: unknown, label: string, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${label}格式不正確`);
  return parsed;
}

function amount(value: unknown, label: string, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(`${label}格式不正確`);
  return Math.round(parsed * 100) / 100;
}

function optionalAmount(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  return amount(value, label, 0.01);
}

function optionalDate(value: unknown, label: string) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label}格式不正確`);
  return date.toISOString();
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength) || null;
}

function parsePayload(body: PromoPayload): PromoMutation {
  const code = normalizeReferralCode(String(body.code || ''));
  if (referralCodeLength(code) < MIN_REFERRAL_CODE_LENGTH) throw new Error('優惠碼至少需要 2 個字元');

  const rewardType: RewardType = body.reward_type === 'tokens' ? 'tokens' : 'discount';
  const maxUses = integer(body.max_uses ?? 1, '總使用次數', 1);
  const maxUsesPerUser = integer(body.max_uses_per_user ?? 1, '每人使用次數', 1);
  const startsAt = optionalDate(body.starts_at, '開始時間');
  const expiresAt = optionalDate(body.expires_at, '結束時間');
  if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
    throw new Error('結束時間必須晚於開始時間');
  }

  if (rewardType === 'tokens') {
    return {
      code,
      name: cleanText(body.name, 80),
      reward_type: rewardType,
      reward_tokens: integer(body.reward_tokens, '儲值金回饋', 1),
      discount_type: null,
      discount_value: 0,
      max_discount: null,
      min_order_amount: 0,
      max_uses: maxUses,
      max_uses_per_user: maxUsesPerUser,
      starts_at: startsAt,
      expires_at: expiresAt,
      is_active: body.is_active !== false,
      audience_type: 'public' as const,
      assigned_email: null,
      company_name: null,
      allowed_email_domain: null,
      updated_at: new Date().toISOString()
    };
  }

  const discountType: DiscountType = body.discount_type === 'fixed' ? 'fixed' : 'percent';
  const discountValue = amount(body.discount_value, '折扣數值', 0.01);
  if (discountType === 'percent' && discountValue >= 100) throw new Error('百分比折扣需小於 100%');
  const audienceType: AudienceType = body.audience_type === 'personal'
    ? 'personal'
    : body.audience_type === 'company' ? 'company' : 'public';
  const assignedEmail = audienceType === 'personal'
    ? cleanText(body.assigned_email, 254)?.toLowerCase() || null
    : null;
  if (audienceType === 'personal' && (!assignedEmail || !assignedEmail.includes('@'))) {
    throw new Error('個人優惠碼需填寫指定會員 Email');
  }
  const companyName = audienceType === 'company' ? cleanText(body.company_name, 100) : null;
  if (audienceType === 'company' && !companyName) throw new Error('企業優惠碼需填寫企業名稱');
  return {
    code,
    name: cleanText(body.name, 80),
    reward_type: rewardType,
    reward_tokens: 0,
    discount_type: discountType,
    discount_value: discountValue,
    max_discount: discountType === 'percent' ? optionalAmount(body.max_discount, '最高折抵金額') : null,
    min_order_amount: amount(body.min_order_amount ?? 0, '最低消費金額'),
    max_uses: maxUses,
    max_uses_per_user: maxUsesPerUser,
    starts_at: startsAt,
    expires_at: expiresAt,
    is_active: body.is_active !== false,
    audience_type: audienceType,
    assigned_email: assignedEmail,
    company_name: companyName,
    allowed_email_domain: null,
    updated_at: new Date().toISOString()
  };
}

async function ensureNoReferralConflict(code: string) {
  const { config } = await readReferralConfig(getSupabase());
  if (findReferralRuleByCode(config, code) || Object.values(config.customers).some(rule => rule.code === code)) {
    throw new Error('此代碼已被會員推薦碼使用，請換一個');
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '操作失敗';
  return NextResponse.json({ error: message }, { status: message.includes('已存在') ? 409 : 400 });
}

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { data, error } = await getSupabase()
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ promoCodes: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const payload = parsePayload(await request.json());
    await ensureNoReferralConflict(payload.code);
    const { data, error } = await getSupabase()
      .from('promo_codes')
      .insert(payload)
      .select()
      .single();
    if (error?.code === '23505') throw new Error('此優惠碼已存在');
    if (error) throw error;
    return NextResponse.json({ success: true, promoCode: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json() as PromoPayload & { id?: unknown };
    const id = String(body.id || '');
    if (!id) throw new Error('缺少代碼 ID');
    const payload = parsePayload(body);
    await ensureNoReferralConflict(payload.code);

    const supabase = getSupabase();
    const { data: current, error: currentError } = await supabase
      .from('promo_codes')
      .select('used_count')
      .eq('id', id)
      .single();
    if (currentError || !current) throw new Error('找不到優惠碼');
    if (payload.max_uses < Number(current.used_count || 0)) {
      throw new Error(`總使用次數不可低於已使用的 ${Number(current.used_count || 0)} 次`);
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error?.code === '23505') throw new Error('此優惠碼已存在');
    if (error) throw error;
    return NextResponse.json({ success: true, promoCode: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('缺少代碼 ID');
    const supabase = getSupabase();
    const { data: current, error: currentError } = await supabase
      .from('promo_codes')
      .select('used_count')
      .eq('id', id)
      .single();
    if (currentError || !current) throw new Error('找不到優惠碼');
    if (Number(current.used_count || 0) > 0) throw new Error('已有使用紀錄，請改為停用以保留帳務資料');

    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
