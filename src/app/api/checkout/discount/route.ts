import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildReferralQuote, readReferralConfig } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!accessToken) return NextResponse.json({ error: '請先登入再使用折扣碼' }, { status: 401 });

    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser(accessToken);
    if (!authData.user?.email) return NextResponse.json({ error: '登入狀態已過期，請重新登入' }, { status: 401 });

    const body = await request.json();
    const productIds: string[] = Array.isArray(body.productIds)
      ? body.productIds.map((id: unknown) => String(id || '')).filter(Boolean)
      : [];
    const code = String(body.code || '');
    if (!productIds.length || productIds.length > 20) {
      return NextResponse.json({ error: '購物車內容不正確' }, { status: 400 });
    }

    const uniqueProductIds = [...new Set(productIds)];
    const { data: products, error } = await supabase
      .from('products')
      .select('id, price')
      .in('id', uniqueProductIds);
    if (error) throw error;

    const productMap = new Map((products || []).map(product => [product.id, Math.round(Number(product.price))]));
    const originalTotal = productIds.reduce((sum, id) => sum + Number(productMap.get(id) || 0), 0);
    if (!originalTotal || productMap.size !== uniqueProductIds.length) {
      return NextResponse.json({ error: '部分商品已下架，請重新整理購物車' }, { status: 400 });
    }

    const { config } = await readReferralConfig(supabase);
    const quote = buildReferralQuote(config, authData.user.email, code, originalTotal);
    return NextResponse.json({ success: true, quote });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '折扣碼無法使用' }, { status: 400 });
  }
}
