import { NextResponse } from 'next/server';
import { requireDealerUser } from '@/lib/dealer-auth';
import { authenticationErrorResponse } from '@/lib/server-auth';
import { readReferralConfig } from '@/lib/referrals';
import { MIN_REFERRAL_CODE_LENGTH, normalizeReferralCode, referralCodeLength } from '@/lib/referral-code';

export async function GET(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    if (dealer.sales_mode !== 'referral') {
      return NextResponse.json({ error: '此帳號不是推薦碼合作模式' }, { status: 403 });
    }

    const [{ data: commissions, error: commissionError }, { data: payouts, error: payoutError }] = await Promise.all([
      supabase
        .from('dealer_referral_commissions')
        .select('id, code_snapshot, original_amount, discount_amount, paid_amount, item_count, commission_amount, status, available_at, paid_at, created_at, orders ( order_number, payment_status, order_status )')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('dealer_referral_payouts')
        .select('id, amount, status, dealer_note, admin_note, requested_at, reviewed_at, paid_at')
        .eq('dealer_id', dealer.id)
        .order('requested_at', { ascending: false })
        .limit(50)
    ]);
    if (commissionError) throw commissionError;
    if (payoutError) throw payoutError;

    const rows = commissions || [];
    const amountFor = (statuses: string[]) => rows
      .filter(item => statuses.includes(item.status))
      .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

    return NextResponse.json({
      summary: {
        totalOrders: rows.filter(item => item.status !== 'cancelled').length,
        pendingAmount: amountFor(['pending']),
        availableAmount: amountFor(['available']),
        requestedAmount: amountFor(['requested']),
        paidAmount: amountFor(['paid'])
      },
      commissions: rows,
      payouts: payouts || []
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '讀取推薦分潤失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { dealer, supabase } = await requireDealerUser(request, true);
    if (dealer.sales_mode !== 'referral') {
      return NextResponse.json({ error: '此帳號不是推薦碼合作模式' }, { status: 403 });
    }
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'updateCode') {
      const code = normalizeReferralCode(String(body.code || ''));
      if (referralCodeLength(code) < MIN_REFERRAL_CODE_LENGTH) {
        return NextResponse.json({ error: `推薦碼至少需要 ${MIN_REFERRAL_CODE_LENGTH} 個中英文字或數字` }, { status: 400 });
      }
      const [{ data: dealerConflict }, { data: promoConflict }, referral] = await Promise.all([
        supabase.from('dealers').select('id').eq('referral_code', code).neq('id', dealer.id).maybeSingle(),
        supabase.from('promo_codes').select('id').eq('code', code).maybeSingle(),
        readReferralConfig(supabase)
      ]);
      const memberConflict = Object.values(referral.config.customers).some(rule => rule.code === code);
      if (dealerConflict || promoConflict || memberConflict) {
        return NextResponse.json({ error: '此推薦碼已被使用，請換一個' }, { status: 409 });
      }

      const { data, error } = await supabase
        .from('dealers')
        .update({ referral_code: code })
        .eq('id', dealer.id)
        .eq('sales_mode', 'referral')
        .select('referral_code')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, referralCode: data.referral_code });
    }

    if (action === 'requestPayout') {
      const note = String(body.note || '').trim().slice(0, 300);
      const { data, error } = await supabase.rpc('request_dealer_referral_payout', {
        p_dealer_id: dealer.id,
        p_dealer_note: note || null
      });
      if (error?.message.includes('PAYOUT_ALREADY_REQUESTED')) {
        return NextResponse.json({ error: '已有一筆待處理的撥款申請' }, { status: 409 });
      }
      if (error?.message.includes('NO_AVAILABLE_COMMISSION')) {
        return NextResponse.json({ error: '目前沒有可申請撥款的分潤' }, { status: 400 });
      }
      if (error) throw error;
      return NextResponse.json({ success: true, payout: data?.[0] });
    }

    return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Dealer referral action failed:', error);
    return NextResponse.json({ error: '推薦碼操作失敗' }, { status: 500 });
  }
}
