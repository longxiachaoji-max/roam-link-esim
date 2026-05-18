import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { email, game } = await request.json();

    if (!email || !game) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 取得使用者目前餘額
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('token_balance')
      .eq('email', email)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json({ error: '找不到會員' }, { status: 404 });
    }

    // 發放 5 元儲值金 (或 10 元) 作為獎勵
    const rewardAmount = 5;
    const newBalance = (customer.token_balance || 0) + rewardAmount;

    // 更新餘額
    const { error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('email', email);

    if (updateError) {
      return NextResponse.json({ error: '更新餘額失敗' }, { status: 500 });
    }

    // 可以紀錄發放日誌 (Topup History)
    await supabase.from('topup_history').insert([
      {
        customer_email: email,
        amount: rewardAmount,
        type: 'bonus',
        status: 'completed',
        remark: `遊樂場過關獎勵 (${game})`
      }
    ]);

    return NextResponse.json({ success: true, reward: rewardAmount, newBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}