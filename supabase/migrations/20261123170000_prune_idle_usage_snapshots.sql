-- 2026-11-23 已在正式站執行：沒有用量變化的時段只保留停止後 1 小時、恢復前 1 小時的紀錄
-- 刪除前完整備份在 public.esim_usage_snapshots_backup_20261123（6930 筆），刪除 4602 筆
create table if not exists public.esim_usage_snapshots_backup_20261123 as select * from public.esim_usage_snapshots;
alter table public.esim_usage_snapshots_backup_20261123 enable row level security;
with s as (
  select id, inventory_id, checked_at,
    (status is distinct from lag(status) over w or used_mb is distinct from lag(used_mb) over w) as is_change
  from esim_usage_snapshots window w as (partition by inventory_id order by checked_at)
), r as (
  select *, sum(case when is_change then 1 else 0 end) over (partition by inventory_id order by checked_at) as run_no from s
), b as (
  select r.*, min(checked_at) over (partition by inventory_id, run_no) as run_start,
    coalesce(
      (select min(r2.checked_at) from r r2 where r2.inventory_id = r.inventory_id and r2.run_no = r.run_no + 1),
      (select max(r3.checked_at) from r r3 where r3.inventory_id = r.inventory_id)
    ) as run_next
  from r
)
delete from esim_usage_snapshots where id in (
  select id from b where checked_at > run_start + interval '1 hour' and checked_at < run_next - interval '1 hour'
);
