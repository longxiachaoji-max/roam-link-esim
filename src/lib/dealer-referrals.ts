import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeReferralCode } from '@/lib/referral-code';
import { calculateDealerCommissionAmount, type DealerCommissionMode } from '@/lib/dealer-referral-math';

export type { DealerCommissionMode } from '@/lib/dealer-referral-math';

export interface DealerReferralQuote {
  source: 'dealer_referral';
  label: string;
  dealerId: string;
  code: string;
  originalTotal: number;
  discountPercent: number;
  discountAmount: number;
  payableTotal: number;
  commissionMode: DealerCommissionMode;
  commissionValue: number;
}

function percent(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(99.99, Math.max(0, parsed)) : 0;
}

export async function findDealerReferralQuote(
  supabase: SupabaseClient,
  customerEmail: string,
  rawCode: string,
  originalTotal: number
): Promise<DealerReferralQuote | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;

  const { data: dealer, error } = await supabase
    .from('dealers')
    .select('id, email, store_name, referral_code, referral_discount_percent, referral_commission_mode, referral_commission_value')
    .eq('status', 'approved')
    .eq('sales_mode', 'referral')
    .eq('referral_code', code)
    .maybeSingle();
  if (error) throw error;
  if (!dealer) return null;
  if (String(dealer.email || '').toLowerCase() === String(customerEmail || '').trim().toLowerCase()) {
    throw new Error('不可輸入自己的推薦碼');
  }

  const discountPercent = percent(dealer.referral_discount_percent);
  const discountAmount = Math.min(originalTotal, Math.round(originalTotal * discountPercent / 100));
  const commissionMode: DealerCommissionMode = dealer.referral_commission_mode === 'fixed' ? 'fixed' : 'percentage';
  const commissionValue = Math.max(0, Number(dealer.referral_commission_value) || 0);

  return {
    source: 'dealer_referral',
    label: `${dealer.store_name || '合作夥伴'}推薦優惠`,
    dealerId: dealer.id,
    code,
    originalTotal,
    discountPercent,
    discountAmount,
    payableTotal: Math.max(0, originalTotal - discountAmount),
    commissionMode,
    commissionValue
  };
}

export function calculateDealerCommission(quote: DealerReferralQuote, itemCount: number) {
  return calculateDealerCommissionAmount(quote.payableTotal, quote.commissionMode, quote.commissionValue, itemCount);
}

export async function recordDealerReferralCommission(
  supabase: SupabaseClient,
  orderId: string,
  quote: DealerReferralQuote,
  itemCount: number,
  paid: boolean
) {
  const normalizedItemCount = Math.max(1, Math.round(itemCount));
  const commissionAmount = calculateDealerCommission(quote, normalizedItemCount);
  const now = new Date().toISOString();

  const { error: orderError } = await supabase
    .from('orders')
    .update({ dealer_referral_id: quote.dealerId, dealer_referral_code_snapshot: quote.code })
    .eq('id', orderId);
  if (orderError) throw orderError;

  const { error } = await supabase.from('dealer_referral_commissions').upsert({
    dealer_id: quote.dealerId,
    order_id: orderId,
    code_snapshot: quote.code,
    original_amount: quote.originalTotal,
    discount_amount: quote.discountAmount,
    paid_amount: quote.payableTotal,
    item_count: normalizedItemCount,
    commission_mode: quote.commissionMode,
    commission_value: quote.commissionValue,
    commission_amount: commissionAmount,
    status: paid ? 'available' : 'pending',
    available_at: paid ? now : null
  }, { onConflict: 'order_id' });
  if (error) throw error;
}
