import type { SupabaseClient } from '@supabase/supabase-js';

// eSIM 管理頁的共享群組：擁有者可以把自己的 eSIM 管理頁分享給其他 Email，
// 被加入的人用自己的一飛通會員帳號登入後可以一起查看用量、整理分類。

export type DashboardRole = 'owner' | 'member';

export interface DashboardSummary {
  ownerId: string;
  ownerEmail: string;
  role: DashboardRole;
}

export class DashboardAccessError extends Error {
  constructor(message: string, public readonly status = 403) {
    super(message);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMemberEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null;
}

export async function findCustomerByEmail(supabase: SupabaseClient, email: string) {
  const { data } = await supabase.from('customers').select('id, email, token_balance').eq('email', email.toLowerCase()).maybeSingle();
  return data as { id: string; email: string; token_balance: number | null } | null;
}

// 列出這個 Email 可以看的管理頁：自己的（有會員資料時）＋別人分享給他的
export async function listDashboards(supabase: SupabaseClient, viewerEmail: string, viewerCustomerId: string | null) {
  const dashboards: DashboardSummary[] = [];
  if (viewerCustomerId) dashboards.push({ ownerId: viewerCustomerId, ownerEmail: viewerEmail, role: 'owner' });
  const { data, error } = await supabase
    .from('esim_dashboard_members')
    .select('owner_customer_id, customers:owner_customer_id ( email )')
    .eq('member_email', viewerEmail.toLowerCase());
  if (error) {
    console.warn('esim_dashboard_members read failed (migration not applied?):', error.message);
    return dashboards;
  }
  for (const row of (data || []) as unknown as { owner_customer_id: string; customers: { email: string } | { email: string }[] | null }[]) {
    if (row.owner_customer_id === viewerCustomerId) continue;
    const owner = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    dashboards.push({ ownerId: row.owner_customer_id, ownerEmail: owner?.email || '', role: 'member' });
  }
  return dashboards;
}

export async function resolveDashboardRole(
  supabase: SupabaseClient,
  viewerEmail: string,
  viewerCustomerId: string | null,
  ownerId: string
): Promise<DashboardRole> {
  if (viewerCustomerId && viewerCustomerId === ownerId) return 'owner';
  const { data } = await supabase
    .from('esim_dashboard_members')
    .select('id')
    .eq('owner_customer_id', ownerId)
    .eq('member_email', viewerEmail.toLowerCase())
    .maybeSingle();
  if (!data) throw new DashboardAccessError('沒有權限查看這個 eSIM 管理頁');
  return 'member';
}

// 檢查登入者能不能操作某位客戶的 eSIM（本人或共享群組成員）
export async function canAccessCustomerEsims(supabase: SupabaseClient, viewerEmail: string, ownerCustomerId: string) {
  const viewer = await findCustomerByEmail(supabase, viewerEmail);
  try {
    return await resolveDashboardRole(supabase, viewerEmail, viewer?.id || null, ownerCustomerId);
  } catch {
    return null;
  }
}
