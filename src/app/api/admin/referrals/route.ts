import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
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

function percent(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numberValue * 100) / 100));
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { config } = await readReferralConfig(supabase);
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取推薦碼設定失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { usageGuide, config } = await readReferralConfig(supabase);

    if (body.defaults) {
      config.defaultDiscountPercent = percent(body.defaults.discountPercent, config.defaultDiscountPercent);
      config.defaultBuyerRewardPercent = percent(body.defaults.buyerRewardPercent, config.defaultBuyerRewardPercent);
      config.defaultReferrerRewardPercent = percent(body.defaults.referrerRewardPercent, config.defaultReferrerRewardPercent);
    }

    if (body.customer) {
      const email = String(body.customer.email || '').trim().toLowerCase();
      if (!email) return NextResponse.json({ error: '缺少會員 Email' }, { status: 400 });

      const code = normalizeReferralCode(String(body.customer.code || ''));
      if (code && code.length < 4) {
        return NextResponse.json({ error: '推薦碼至少需要 4 個英數字' }, { status: 400 });
      }
      if (code && !ensureReferralCodeIsUnique(config, code, email)) {
        return NextResponse.json({ error: '此推薦碼已被其他會員使用' }, { status: 400 });
      }
      if (code) {
        const { data: promoConflict } = await supabase
          .from('promo_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (promoConflict) return NextResponse.json({ error: '此代碼已被活動碼使用，請換一個' }, { status: 400 });
      }

      if (!code && config.customers[email]) {
        delete config.customers[email];
      } else if (code) {
        config.customers[email] = {
          email,
          code,
          enabled: body.customer.enabled !== false,
          discountPercent: percent(body.customer.discountPercent, config.defaultDiscountPercent),
          buyerRewardPercent: percent(body.customer.buyerRewardPercent, config.defaultBuyerRewardPercent),
          referrerRewardPercent: percent(body.customer.referrerRewardPercent, config.defaultReferrerRewardPercent),
          updatedAt: new Date().toISOString()
        };
      }
    }

    await saveReferralConfig(supabase, usageGuide, config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '儲存推薦碼設定失敗' }, { status: 500 });
  }
}
