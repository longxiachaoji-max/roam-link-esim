import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_REFERRAL_CONFIG,
  ensureReferralCodeIsUnique,
  normalizeReferralCode,
  readReferralConfig,
  saveReferralConfig
} from '@/lib/referrals';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key);
}

async function getAuthUser(request: Request, supabase: ReturnType<typeof getSupabase>) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return null;
  const { data } = await supabase.auth.getUser(accessToken);
  return data.user;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request, supabase);
    if (!user?.email) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const { config } = await readReferralConfig(supabase);
    const email = user.email.toLowerCase();
    const rule = config.customers[email] || null;

    return NextResponse.json({
      referral: rule,
      defaults: {
        discountPercent: config.defaultDiscountPercent,
        buyerRewardPercent: config.defaultBuyerRewardPercent,
        referrerRewardPercent: config.defaultReferrerRewardPercent
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取推薦碼失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request, supabase);
    if (!user?.email) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const body = await request.json();
    const code = normalizeReferralCode(String(body.code || ''));
    if (code.length < 4) {
      return NextResponse.json({ error: '推薦碼至少需要 4 個英數字' }, { status: 400 });
    }

    const { data: promoConflict } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (promoConflict) return NextResponse.json({ error: '此代碼已被活動碼使用，請換一個' }, { status: 400 });

    const { usageGuide, config } = await readReferralConfig(supabase);
    const email = user.email.toLowerCase();
    if (!ensureReferralCodeIsUnique(config, code, email)) {
      return NextResponse.json({ error: '此推薦碼已被其他會員使用' }, { status: 400 });
    }

    config.customers[email] = {
      email,
      code,
      enabled: true,
      discountPercent: config.customers[email]?.discountPercent ?? DEFAULT_REFERRAL_CONFIG.defaultDiscountPercent,
      buyerRewardPercent: config.customers[email]?.buyerRewardPercent ?? DEFAULT_REFERRAL_CONFIG.defaultBuyerRewardPercent,
      referrerRewardPercent: config.customers[email]?.referrerRewardPercent ?? DEFAULT_REFERRAL_CONFIG.defaultReferrerRewardPercent,
      updatedAt: new Date().toISOString()
    };

    await saveReferralConfig(supabase, usageGuide, config);
    return NextResponse.json({ success: true, referral: config.customers[email] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '儲存推薦碼失敗' }, { status: 500 });
  }
}
