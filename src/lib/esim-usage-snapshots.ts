// eSIM 用量紀錄：查 MicroEsim 用量 → 更新快取 → 寫一筆歷史紀錄（esim_usage_snapshots）
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMicroesimDeviceDetail, fetchMicroesimEventDetail } from '@/lib/microesim';
import { normalizeMicroesimUsage, type MicroesimUsageSummary } from '@/lib/microesim-usage';
import { parseUsageMb } from '@/lib/usage-mb';

export { parseUsageMb };

export interface UsageInventory {
  id: string;
  iccid: string | null;
  microesim_topup_id: string | null;
}

export type UsageSnapshotSource = 'cron' | 'manual';

export async function recordUsageSnapshot(
  supabase: SupabaseClient,
  inventory: UsageInventory,
  usage: MicroesimUsageSummary,
  source: UsageSnapshotSource,
  checkedAt: string
) {
  const { error } = await supabase.from('esim_usage_snapshots').insert({
    inventory_id: inventory.id,
    iccid: inventory.iccid,
    status: usage.status,
    used_data: usage.usedData,
    used_mb: parseUsageMb(usage.usedData),
    source,
    checked_at: checkedAt
  });
  // 資料表還沒建立時不要讓用量查詢失敗
  if (error) console.warn('esim_usage_snapshots insert failed (migration not applied?):', error.message);
}

export async function queryAndStoreUsage(
  supabase: SupabaseClient,
  inventory: UsageInventory,
  installationDeadline: string | null,
  source: UsageSnapshotSource
) {
  if (!inventory.microesim_topup_id || !inventory.iccid) throw new Error('缺少 MicroEsim 查詢資料');
  const detail = await fetchMicroesimDeviceDetail(inventory.microesim_topup_id, inventory.iccid);
  const events = await fetchMicroesimEventDetail(inventory.iccid).catch(error => {
    console.warn('MicroEsim event query failed:', error instanceof Error ? error.message : error);
    return [];
  });
  const usage = normalizeMicroesimUsage(detail, events, installationDeadline);
  const checkedAt = new Date().toISOString();
  await supabase
    .from('e_sim_inventory')
    .update({
      ...(installationDeadline ? { expiry_date: installationDeadline } : {}),
      microesim_usage_cache: usage,
      microesim_usage_checked_at: checkedAt
    })
    .eq('id', inventory.id);
  await recordUsageSnapshot(supabase, inventory, usage, source, checkedAt);
  return { usage, checkedAt };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FINAL_STATUSES = new Set(['已到期', '已刪除', '已停用']);

/** 排程用：更新所有還在使用期的 MicroEsim eSIM */
export async function refreshAllActiveUsage(supabase: SupabaseClient, options: { limit?: number; gapMs?: number; minAgeMinutes?: number } = {}) {
  const { data, error } = await supabase
    .from('e_sim_inventory')
    .select('id, iccid, microesim_topup_id, expiry_date, microesim_usage_cache, microesim_usage_checked_at')
    .not('microesim_topup_id', 'is', null)
    .not('iccid', 'is', null)
    .order('microesim_usage_checked_at', { ascending: true, nullsFirst: true })
    .limit(1000);
  if (error) throw error;

  const cutoff = Date.now() - (options.minAgeMinutes ?? 20) * 60_000;
  const due = (data || []).filter(row => {
    const status = (row.microesim_usage_cache as { status?: string } | null)?.status || '';
    if (FINAL_STATUSES.has(status)) return false;
    const checked = row.microesim_usage_checked_at ? new Date(row.microesim_usage_checked_at).getTime() : 0;
    return checked <= cutoff;
  }).slice(0, options.limit ?? 90);

  // MicroEsim 有帳號層級的頻率限制：一張一張查，中間停一下，遇到 Too Many Requests 等久一點再試一次
  let ok = 0;
  let failed = 0;
  const gapMs = options.gapMs ?? 800;
  for (const row of due) {
    try {
      await queryAndStoreUsage(supabase, row, row.expiry_date, 'cron');
      ok += 1;
    } catch (error) {
      if (/too many requests|rate limit/i.test(error instanceof Error ? error.message : '')) {
        await sleep(5000);
        try {
          await queryAndStoreUsage(supabase, row, row.expiry_date, 'cron');
          ok += 1;
        } catch {
          failed += 1;
        }
      } else {
        failed += 1;
      }
    }
    await sleep(gapMs);
  }
  return { due: due.length, ok, failed };
}
