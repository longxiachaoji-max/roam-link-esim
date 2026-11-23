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
  const usedMb = parseUsageMb(usage.usedData);
  const { error } = await supabase.from('esim_usage_snapshots').insert({
    inventory_id: inventory.id,
    iccid: inventory.iccid,
    status: usage.status,
    used_data: usage.usedData,
    used_mb: usedMb,
    source,
    checked_at: checkedAt
  });
  // 資料表還沒建立時不要讓用量查詢失敗
  if (error) {
    console.warn('esim_usage_snapshots insert failed (migration not applied?):', error.message);
    return;
  }
  await pruneIdleSnapshots(supabase, inventory.id, usage.status ?? null, usedMb, checkedAt);
}

const IDLE_KEEP_MS = 60 * 60 * 1000;

/**
 * 沒有用量變化的時段只留頭尾各 1 小時：
 * 用量停止後保留 1 小時的紀錄，之後只保留「最近 1 小時」，
 * 等用量又開始增加時，剛好留下開始前 1 小時的紀錄。
 */
async function pruneIdleSnapshots(supabase: SupabaseClient, inventoryId: string, status: string | null, usedMb: number | null, checkedAt: string) {
  try {
    // 最近一筆「和現在不一樣」的紀錄 → 它之後的第一筆就是這段沒變化的開始
    let changed = supabase
      .from('esim_usage_snapshots')
      .select('checked_at')
      .eq('inventory_id', inventoryId)
      .lt('checked_at', checkedAt)
      .order('checked_at', { ascending: false })
      .limit(1);
    const sameStatus = status === null ? 'status.not.is.null' : `status.is.null,status.neq.${JSON.stringify(status)}`;
    const sameMb = usedMb === null ? 'used_mb.not.is.null' : `used_mb.is.null,used_mb.neq.${usedMb}`;
    changed = changed.or(`${sameStatus},${sameMb}`);
    const { data: lastDifferent, error: differentError } = await changed.maybeSingle();
    // 查詢失敗就不要刪，避免誤刪整段紀錄
    if (differentError) {
      console.warn('Prune idle usage snapshots skipped:', differentError.message);
      return;
    }

    let runStartQuery = supabase
      .from('esim_usage_snapshots')
      .select('checked_at')
      .eq('inventory_id', inventoryId)
      .order('checked_at', { ascending: true })
      .limit(1);
    if (lastDifferent?.checked_at) runStartQuery = runStartQuery.gt('checked_at', lastDifferent.checked_at);
    const { data: runStart, error: runStartError } = await runStartQuery.maybeSingle();
    if (runStartError || !runStart?.checked_at) return;

    const keepAfterStop = new Date(Date.parse(runStart.checked_at) + IDLE_KEEP_MS).toISOString();
    const keepBeforeNow = new Date(Date.parse(checkedAt) - IDLE_KEEP_MS).toISOString();
    if (keepAfterStop >= keepBeforeNow) return;
    const { error } = await supabase
      .from('esim_usage_snapshots')
      .delete()
      .eq('inventory_id', inventoryId)
      .gt('checked_at', keepAfterStop)
      .lt('checked_at', keepBeforeNow);
    if (error) console.warn('Prune idle usage snapshots failed:', error.message);
  } catch (error) {
    console.warn('Prune idle usage snapshots failed:', error);
  }
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

export const FINAL_STATUSES = new Set(['已到期', '已刪除', '已停用']);

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
