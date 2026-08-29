import { NextResponse } from 'next/server';
import { authenticationErrorResponse } from '@/lib/server-auth';
import { requireDealerUser } from '@/lib/dealer-auth';

export async function POST(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    const body = await request.json();
    const amount = Math.round(Number(body.amount));
    const note = String(body.note || '').trim().slice(0, 300);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
      return NextResponse.json({ error: '加值金額不正確' }, { status: 400 });
    }
    const { data: pending } = await supabase
      .from('dealer_topup_requests')
      .select('id')
      .eq('dealer_id', dealer.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pending) return NextResponse.json({ error: '已有待審核的加值申請' }, { status: 409 });

    const { data, error } = await supabase
      .from('dealer_topup_requests')
      .insert({ dealer_id: dealer.id, amount, note: note || null })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ request: data });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '建立加值申請失敗' }, { status: 500 });
  }
}
