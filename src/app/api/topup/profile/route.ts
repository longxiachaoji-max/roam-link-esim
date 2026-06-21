import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('資料庫服務尚未設定');
  return createClient(url, serviceKey);
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!accessToken) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser?.email) return NextResponse.json({ error: '登入狀態已過期' }, { status: 401 });

    let { data: customer } = await supabase
      .from('customers')
      .select('email, name, token_balance')
      .eq('email', authUser.email)
      .single();

    if (!customer) {
      const { data: createdCustomer, error: createError } = await supabase
        .from('customers')
        .insert([{
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email.split('@')[0],
          token_balance: 0
        }])
        .select('email, name, token_balance')
        .single();
      if (createError) throw createError;
      customer = createdCustomer;
    }

    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '無法載入會員資料' }, { status: 500 });
  }
}
