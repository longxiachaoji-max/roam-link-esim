import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const { code } = body;
    const email = user.email.toLowerCase();

    if (!code) {
      return NextResponse.json({ error: '請輸入兌換碼' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. 取得客戶
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: '找不到此客戶' }, { status: 404 });
    }

    // 2. 驗證兌換碼
    const { data: promo, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (promoError || !promo) {
      return NextResponse.json({ error: '無效的兌換碼' }, { status: 400 });
    }

    if (promo.reward_type === 'discount') {
      return NextResponse.json({ error: '此代碼為結帳優惠碼，請在購物車結帳時使用' }, { status: 400 });
    }
    if (promo.is_active === false) {
      return NextResponse.json({ error: '此兌換碼目前未啟用' }, { status: 400 });
    }
    if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
      return NextResponse.json({ error: '此兌換碼尚未開始' }, { status: 400 });
    }

    // 檢查到期
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({ error: '此兌換碼已過期' }, { status: 400 });
    }

    // 檢查總使用次數
    if (promo.used_count >= promo.max_uses) {
      return NextResponse.json({ error: '此兌換碼已達使用上限' }, { status: 400 });
    }

    // 3. 檢查此用戶的兌換次數
    const maxPerUser = promo.max_uses_per_user || 1;
    const { data: userRedemptions } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('promo_code_id', promo.id);

    const userUsedCount = userRedemptions?.length || 0;
    if (userUsedCount >= maxPerUser) {
      return NextResponse.json({ error: `您已兌換過此代碼 (每人限 ${maxPerUser} 次)` }, { status: 400 });
    }

    // 4. 更新客戶餘額
    const newBalance = customer.token_balance + promo.reward_tokens;
    const { error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('id', customer.id);

    if (updateError) throw updateError;

    // 5. 增加 promo 使用次數
    await supabase
      .from('promo_codes')
      .update({ used_count: promo.used_count + 1 })
      .eq('id', promo.id);

    // 6. 記錄兌換紀錄
    await supabase
      .from('promo_redemptions')
      .insert({ customer_id: customer.id, promo_code_id: promo.id });

    // 7. 記錄到 token_transactions (如果有此表)
    await supabase
      .from('token_transactions')
      .insert({
        customer_id: customer.id,
        amount: promo.reward_tokens,
        transaction_type: 'topup',
        balance_after: newBalance,
        reason: `兌換代碼: ${promo.code}`
      });

    return NextResponse.json({
      success: true,
      message: `成功兌換！獲得 ${promo.reward_tokens} 點`,
      addedTokens: promo.reward_tokens,
      newBalance
    });

  } catch (error: any) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Promo redemption error:', error);
    return NextResponse.json({ error: error.message || '系統錯誤' }, { status: 500 });
  }
}
