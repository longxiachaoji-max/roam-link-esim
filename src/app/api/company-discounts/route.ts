import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  companyDiscountLabel,
  companyNameMatches,
  isCompanyDiscountAvailable,
  normalizeCompanyName,
  type CompanyDiscountRow
} from '@/lib/company-discounts';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('查詢服務尚未設定');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('company')?.trim().slice(0, 80) || '';
  if (normalizeCompanyName(query).length < 2) {
    return NextResponse.json({ error: '請輸入至少 2 個字的企業名稱' }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabase()
      .from('promo_codes')
      .select('code, company_name, discount_type, discount_value, max_discount, min_order_amount, max_uses, used_count, starts_at, expires_at')
      .eq('reward_type', 'discount')
      .eq('audience_type', 'company')
      .eq('is_active', true)
      .not('company_name', 'is', null)
      .limit(500);
    if (error) throw error;

    const results = ((data || []) as CompanyDiscountRow[])
      .filter(row => isCompanyDiscountAvailable(row) && companyNameMatches(row.company_name || '', query))
      .slice(0, 8)
      .map(row => ({
        companyName: row.company_name,
        code: row.code,
        discountLabel: companyDiscountLabel(row),
        minOrderAmount: Number(row.min_order_amount || 0),
        startsAt: row.starts_at,
        expiresAt: row.expires_at
      }));

    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Company discount lookup failed:', error);
    return NextResponse.json({ error: '目前無法查詢，請稍後再試' }, { status: 500 });
  }
}
