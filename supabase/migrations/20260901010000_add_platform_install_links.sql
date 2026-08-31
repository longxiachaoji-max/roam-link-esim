alter table public.e_sim_inventory
  add column if not exists ios_install_url text,
  add column if not exists android_install_url text;
