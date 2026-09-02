import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAdminUser } from '@/lib/server-auth';
import { readReferralConfig } from '@/lib/referrals';
import { MIN_REFERRAL_CODE_LENGTH, normalizeReferralCode, referralCodeLength } from '@/lib/referral-code';

const DEALER_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);
const PRICING_MODES = new Set(['percentage_markup', 'fixed_markup']);
const SALES_MODES = new Set(['direct', 'referral']);
const COMMISSION_MODES = new Set(['percentage', 'fixed']);

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const [{ data: dealers, error: dealerError }, { data: topups, error: topupError }, { data: payouts, error: payoutError }] = await Promise.all([
      supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('dealer_topup_requests')
        .select('*, dealers ( store_name, email, balance )')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('dealer_referral_payouts')
        .select('id, dealer_id, amount, status, dealer_note, admin_note, requested_at, dealers ( store_name, email )')
        .order('requested_at', { ascending: false })
        .limit(100)
    ]);
    if (dealerError) throw dealerError;
    if (topupError) throw topupError;
    if (payoutError) throw payoutError;
    return NextResponse.json({ dealers: dealers || [], topupRequests: topups || [], referralPayouts: payouts || [] });
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
      const salesMode = String(body.salesMode || 'direct');
      const referralCode = normalizeReferralCode(String(body.referralCode || ''));
      const referralDiscountPercent = Number(body.referralDiscountPercent);
      const referralCommissionMode = String(body.referralCommissionMode || 'percentage');
      const referralCommissionValue = Number(body.referralCommissionValue);
      const validValue = pricingMode === 'percentage_markup'
        ? pricingValue >= 0 && pricingValue <= 500
        : pricingValue >= 0 && pricingValue <= 100000;
      const validReferralValue = referralCommissionMode === 'percentage'
        ? referralCommissionValue >= 0 && referralCommissionValue <= 100
        : referralCommissionValue >= 0 && referralCommissionValue <= 100000;
      if (!DEALER_STATUSES.has(status) || !SALES_MODES.has(salesMode) || !PRICING_MODES.has(pricingMode)
        || !Number.isFinite(pricingValue) || !validValue
        || !COMMISSION_MODES.has(referralCommissionMode)
        || !Number.isFinite(referralCommissionValue) || !validReferralValue
        || !Number.isFinite(referralDiscountPercent) || referralDiscountPercent < 0 || referralDiscountPercent >= 100) {
        return NextResponse.json({ error: '經銷商設定不正確' }, { status: 400 });
      }
      if (salesMode === 'referral') {
        if (referralCodeLength(referralCode) < MIN_REFERRAL_CODE_LENGTH) {
          return NextResponse.json({ error: `推薦碼至少需要 ${MIN_REFERRAL_CODE_LENGTH} 個中英文字或數字` }, { status: 400 });
        }
        const [{ data: dealerConflict }, { data: promoConflict }, referral] = await Promise.all([
          supabase.from('dealers').select('id').eq('referral_code', referralCode).neq('id', dealerId).maybeSingle(),
          supabase.from('promo_codes').select('id').eq('code', referralCode).maybeSingle(),
          readReferralConfig(supabase)
        ]);
        const memberConflict = Object.values(referral.config.customers).some(rule => rule.code === referralCode);
        if (dealerConflict || promoConflict || memberConflict) {
          return NextResponse.json({ error: '此推薦碼已被使用，請換一個' }, { status: 409 });
        }
      }
      const { data, error } = await supabase
        .from('dealers')
        .update({
          status,
          pricing_mode: pricingMode,
          pricing_value: Math.round(pricingValue * 100) / 100,
          sales_mode: salesMode,
          referral_code: salesMode === 'referral' ? referralCode : null,
          referral_discount_percent: Math.round(referralDiscountPercent * 100) / 100,
          referral_commission_mode: referralCommissionMode,
          referral_commission_value: Math.round(referralCommissionValue * 100) / 100,
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

    if (action === 'reviewReferralPayout') {
      const decision = String(body.decision || '');
      if (decision !== 'paid' && decision !== 'rejected') {
        return NextResponse.json({ error: '撥款處理狀態不正確' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('review_dealer_referral_payout', {
        p_payout_id: String(body.payoutId || ''),
        p_decision: decision,
        p_admin_user_id: admin.id,
        p_admin_note: String(body.adminNote || '').trim().slice(0, 300) || null
      });
      if (error?.message.includes('PAYOUT_ALREADY_REVIEWED')) {
        return NextResponse.json({ error: '此撥款申請已處理' }, { status: 409 });
      }
      if (error) throw error;
      return NextResponse.json({ result: data?.[0] });
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
