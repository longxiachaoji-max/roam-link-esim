-- eSIM 用量歷史紀錄（每 30 分鐘排程 + 手動更新都會寫一筆）
create table if not exists public.esim_usage_snapshots (
  id bigserial primary key,
  inventory_id uuid not null references public.e_sim_inventory(id) on delete cascade,
  iccid text,
  status text,
  used_data text,
  used_mb numeric,
  source text not null default 'cron',
  checked_at timestamp with time zone not null default now()
);

create index if not exists esim_usage_snapshots_inventory_checked_idx
  on public.esim_usage_snapshots (inventory_id, checked_at desc);

-- 只有伺服器（service role）可以讀寫
alter table public.esim_usage_snapshots enable row level security;
