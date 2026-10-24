import type { getServerSupabase } from '@/lib/server-auth';

type ServerSupabase = ReturnType<typeof getServerSupabase>;

// 讀取後台「允許評價」時間。欄位 review_unlocked_at 由 migration 新增；
// 還沒執行 migration 時查詢會失敗，這裡當作都沒開放，不影響其他功能。
export async function fetchReviewUnlocks(supabase: ServerSupabase, orderItemIds: string[]) {
  const unlocks = new Map<string, string>();
  if (!orderItemIds.length) return unlocks;
  const { data, error } = await supabase
    .from('order_items')
    .select('id, review_unlocked_at')
    .in('id', orderItemIds);
  if (error) {
    console.warn('review_unlocked_at unavailable (migration not applied?):', error.message);
    return unlocks;
  }
  for (const row of (data || []) as Array<{ id: string; review_unlocked_at: string | null }>) {
    if (row.review_unlocked_at) unlocks.set(row.id, row.review_unlocked_at);
  }
  return unlocks;
}
