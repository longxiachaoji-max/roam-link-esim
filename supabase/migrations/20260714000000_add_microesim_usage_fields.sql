alter table public.e_sim_inventory
add column if not exists microesim_topup_id text,
add column if not exists microesim_usage_cache jsonb,
add column if not exists microesim_usage_checked_at timestamp with time zone;

create index if not exists idx_e_sim_inventory_microesim_topup_id
on public.e_sim_inventory (microesim_topup_id);
