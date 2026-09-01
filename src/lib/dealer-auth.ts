import { AuthenticationError, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';

export interface DealerAccount {
  id: string;
  user_id: string;
  email: string;
  store_name: string;
  contact_name: string | null;
  phone: string | null;
  tax_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  price_rate_percent: number;
  pricing_mode: 'percentage_markup' | 'fixed_markup';
  pricing_value: number;
  balance: number;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function requireDealerUser(request: Request, approvedOnly = false) {
  const user = await requireAuthenticatedUser(request);
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('dealers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error(`經銷商資料讀取失敗：${error.message}`);
  if (!data) throw new AuthenticationError('尚未申請經銷商帳號', 403);
  if (approvedOnly && data.status !== 'approved') {
    throw new AuthenticationError('經銷商帳號尚未開通或目前已停用', 403);
  }

  return { user, dealer: data as DealerAccount, supabase };
}
