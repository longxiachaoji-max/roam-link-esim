import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAdminUser } from '@/lib/server-auth';

const DEALER_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);
const PRICING_MODES = new Set(['percentage_markup', 'fixed_markup']);

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const [{ data: dealers, error: dealerError }, { data: topups, error: topupError }] = await Promise.all([
      supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('dealer_topup_requests')
        .select('*, dealers ( store_name, email, balance )')
        .order('created_at', { ascending: false })
        .limit(100)
    ]);
    if (dealerError) throw dealerError;
    if (topupError) throw topupError;
    return NextResponse.json({ dealers: dealers || [], topupRequests: topups || [] });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取經銷商資料失敗' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const supabase = getServerSupabase();
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'updateDealer') {
      const dealerId = String(body.dealerId || '');
      const status = String(body.status || '');
      const pricingMode = String(body.pricingMode || '');
      const pricingValue = Number(body.pricingValue);
      const validValue = pricingMode === 'percentage_markup'
        ? pricingValue >= 0 && pricingValue <= 500
        : pricingValue >= 0 && pricingValue <= 100000;
      if (!DEALER_STATUSES.has(status) || !PRICING_MODES.has(pricingMode) || !Number.isFinite(pricingValue) || !validValue) {
        return NextResponse.json({ error: '經銷商設定不正確' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('dealers')
        .update({
          status,
          pricing_mode: pricingMode,
          pricing_value: Math.round(pricingValue * 100) / 100,
          admin_note: String(body.adminNote || '').trim().slice(0, 500) || null,
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', dealerId)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ dealer: data });
    }

    if (action === 'adjustBalance') {
      const amount = Math.round(Number(body.amount));
      const cashReceived = Math.max(0, Math.round(Number(body.cashReceivedAmount) || 0));
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (!Number.isFinite(amount) || amount === 0 || !reason) {
        return NextResponse.json({ error: '請填寫調整金額與原因' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('adjust_dealer_balance', {
        p_dealer_id: String(body.dealerId || ''),
        p_amount: amount,
        p_cash_received_amount: cashReceived,
        p_reason: reason,
        p_admin_user_id: admin.id
      });
      if (error) {
        if (error.message.includes('INSUFFICIENT_BALANCE')) {
          return NextResponse.json({ error: '調整後餘額不可小於 0' }, { status: 400 });
        }
        throw error;
      }
      return NextResponse.json({ result: data?.[0] });
    }

    if (action === 'reviewTopup') {
      const requestId = String(body.requestId || '');
      const decision = String(body.decision || '');
      if (decision === 'approved') {
        const { data, error } = await supabase.rpc('approve_dealer_topup_request', {
          p_request_id: requestId,
          p_admin_user_id: admin.id
        });
        if (error) throw error;
        return NextResponse.json({ result: data?.[0] });
      }
      if (decision === 'rejected') {
        const { data, error } = await supabase
          .from('dealer_topup_requests')
          .update({ status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
          .eq('id', requestId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: '此申請已處理' }, { status: 409 });
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Admin dealer update failed:', error);
    return NextResponse.json({ error: '更新經銷商資料失敗' }, { status: 500 });
  }
}
