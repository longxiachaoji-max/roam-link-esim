import type { SupabaseClient } from '@supabase/supabase-js';

// eSIM 卡片共享：擁有者勾選卡片、輸入對方 Email 共享。
// 對方登入 /app 後會在自己的頁面看到這些卡（可查看用量、掃 QR Code 安裝），
// 分類是每個人自己的，互不影響。

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMemberEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null;
}

export interface CustomerRow { id: string; email: string; token_balance: number | null }

export async function findCustomerByEmail(supabase: SupabaseClient, email: string) {
  const { data } = await supabase.from('customers').select('id, email, token_balance').eq('email', email.toLowerCase()).maybeSingle();
  return data as CustomerRow | null;
}

// 只被共享、自己沒買過的會員可能還沒有 customers 資料；建立分類時再補建
export async function ensureCustomer(supabase: SupabaseClient, email: string) {
  const existing = await findCustomerByEmail(supabase, email);
  if (existing) return existing;
  const normalized = email.toLowerCase();
  const { data, error } = await supabase
    .from('customers')
    .insert([{ email: normalized, name: normalized.split('@')[0], token_balance: 0 }])
    .select('id, email, token_balance')
    .single();
  if (error) {
    const retry = await findCustomerByEmail(supabase, normalized);
    if (retry) return retry;
    throw error;
  }
  return data as CustomerRow;
}

// 登入者可以存取這張 eSIM 嗎？本人回傳 'owner'，被共享回傳 'shared'，否則 null
export async function canAccessEsimItem(
  supabase: SupabaseClient,
  viewerEmail: string,
  orderItemId: string,
  ownerCustomerId: string
): Promise<'owner' | 'shared' | null> {
  const viewer = await findCustomerByEmail(supabase, viewerEmail);
  if (viewer && viewer.id === ownerCustomerId) return 'owner';
  const { data, error } = await supabase
    .from('esim_card_shares')
    .select('order_item_id')
    .eq('order_item_id', orderItemId)
    .eq('member_email', viewerEmail.toLowerCase())
    .maybeSingle();
  if (error) {
    console.warn('esim_card_shares read failed (migration not applied?):', error.message);
    return null;
  }
  return data ? 'shared' : null;
}
