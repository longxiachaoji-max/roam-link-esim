alter table public.physical_orders
  add column if not exists user_deleted_at timestamptz;

create index if not exists physical_orders_user_deleted_idx
  on public.physical_orders (user_deleted_at)
  where user_deleted_at is not null;

comment on column public.physical_orders.user_deleted_at is
  'Time the member requested this order record be hidden. The member API keeps it visible for 24 hours.';
