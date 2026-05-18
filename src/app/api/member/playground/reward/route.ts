import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { email, game, difficulty } = await request.json();

    if (!email || !game) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // Only hard difficulty earns rewards
    if (difficulty !== 'hard') {
      return NextResponse.json({
        success: true,
        reward: 0,
        message: '恭喜過關！'
      });
    }

    const rewardAmount = 1;

    // Check if already claimed today (using UTC start of day)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const { data: history, error: historyError } = await supabase
      .from('topup_history')
      .select('id')
      .eq('customer_email', email)
      .like('remark', '遊樂場過關獎勵%')
      .gte('created_at', todayStr);

    if (history && history.length > 0) {
      // Already claimed today
      return NextResponse.json({ 
        success: true, 
        reward: 0, 
        message: '🎉 過關了！\n\n但您今日已領取過遊樂場獎勵，明天再來挑戰賺儲值金吧！'
      });
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

    const newBalance = (customer.token_balance || 0) + rewardAmount;

    // 更新餘額
    const { error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('email', email);

    if (updateError) {
      return NextResponse.json({ error: '更新餘額失敗' }, { status: 500 });
    }

    const difficultyLabel = difficulty === 'easy' ? '簡單' : difficulty === 'medium' ? '普通' : '困難';

    await supabase.from('topup_history').insert([
      {
        customer_email: email,
        amount: rewardAmount,
        type: 'bonus',
        status: 'completed',
        remark: `遊樂場過關獎勵 (${game} - ${difficultyLabel})`
      }
    ]);

    return NextResponse.json({ 
      success: true, 
      reward: rewardAmount, 
      newBalance,
      message: `恭喜過關！\n成功獲得 ${rewardAmount} 元儲值金！`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
