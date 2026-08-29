import type { SupabaseClient } from '@supabase/supabase-js';

const LEGACY_BARCODE_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;

export function isBarcodeOrderExpired(order: {
  payment_status?: string | null;
  payment_proof_uploaded_at?: string | null;
  ecpay_barcode_expires_at?: string | null;
  created_at?: string | null;
}, now = Date.now()) {
  if (order.payment_status === 'EXPIRED') return true;
  if (order.payment_status === 'PAID' || order.payment_proof_uploaded_at) return false;
  const expiresAt = order.ecpay_barcode_expires_at
    ? new Date(order.ecpay_barcode_expires_at).getTime()
    : order.created_at
      ? new Date(order.created_at).getTime() + LEGACY_BARCODE_EXPIRY_MS
      : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export async function expirePendingBarcodeOrders(supabase: SupabaseClient) {
  const expiredAt = new Date().toISOString();
  const legacyCutoff = new Date(Date.now() - LEGACY_BARCODE_EXPIRY_MS).toISOString();
  const expireUpdates = {
    payment_status: 'EXPIRED',
    order_status: 'CANCELLED',
    updated_at: expiredAt
  };
  const { data: explicitlyExpired, error } = await supabase
    .from('orders')
    .update(expireUpdates)
    .eq('ecpay_payment_method', 'BARCODE')
    .eq('payment_status', 'PENDING')
    .is('payment_proof_uploaded_at', null)
    .not('ecpay_barcode_expires_at', 'is', null)
    .lt('ecpay_barcode_expires_at', expiredAt)
    .select('id');

  if (error) throw error;

  const { data: legacyExpired, error: legacyError } = await supabase
    .from('orders')
    .update(expireUpdates)
    .eq('ecpay_payment_method', 'BARCODE')
    .eq('payment_status', 'PENDING')
    .is('payment_proof_uploaded_at', null)
    .is('ecpay_barcode_expires_at', null)
    .lt('created_at', legacyCutoff)
    .select('id');
  if (legacyError) throw legacyError;

  return { expiredCount: (explicitlyExpired?.length || 0) + (legacyExpired?.length || 0) };
}
