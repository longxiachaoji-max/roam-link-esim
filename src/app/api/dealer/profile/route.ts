import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getServerSupabase();
    const { data: dealer, error } = await supabase
      .from('dealers')
      .select('id, email, store_name, contact_name, phone, status, balance')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!dealer) return NextResponse.json({ dealer: null, email: user.email });

    const [{ data: transactions }, { data: topups }] = await Promise.all([
      supabase
        .from('dealer_balance_transactions')
        .select('id, amount, balance_after, transaction_type, reason, created_at')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('dealer_topup_requests')
        .select('id, amount, note, status, created_at, reviewed_at')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);
    return NextResponse.json({ dealer, transactions: transactions || [], topupRequests: topups || [] });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取經銷商資料失敗' }, { status: 500 });
  }
}
