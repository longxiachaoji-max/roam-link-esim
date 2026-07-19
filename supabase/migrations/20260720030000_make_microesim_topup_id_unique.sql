drop index if exists public.idx_e_sim_inventory_microesim_topup_id;

create unique index if not exists idx_e_sim_inventory_microesim_topup_id
  on public.e_sim_inventory (microesim_topup_id)
  where microesim_topup_id is not null;
