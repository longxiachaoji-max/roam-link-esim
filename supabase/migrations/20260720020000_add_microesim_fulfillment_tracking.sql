create or replace function public.generate_order_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'RL'
    || to_char(timezone('Asia/Taipei', clock_timestamp()), 'YYMMDDHH24MISS')
    || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
$$;

alter table public.orders
  add column if not exists order_number text;

update public.orders
set order_number = 'RL'
  || to_char(timezone('Asia/Taipei', coalesce(created_at, now())), 'YYMMDDHH24MISS')
  || upper(substr(replace(id::text, '-', ''), 1, 4))
where order_number is null;

alter table public.orders
  alter column order_number set default public.generate_order_number(),
  alter column order_number set not null;

create unique index if not exists idx_orders_order_number
  on public.orders (order_number);

alter table public.order_items
  add column if not exists supplier_order_ref text,
  add column if not exists supplier_order_id text,
  add column if not exists supplier_status text,
  add column if not exists supplier_last_checked_at timestamp with time zone,
  add column if not exists supplier_error text;

create unique index if not exists idx_order_items_supplier_order_ref
  on public.order_items (supplier_order_ref)
  where supplier_order_ref is not null;

create unique index if not exists idx_order_items_supplier_order_id
  on public.order_items (supplier_order_id)
  where supplier_order_id is not null;

create index if not exists idx_order_items_pending_supplier
  on public.order_items (supplier_status, supplier_last_checked_at)
  where inventory_id is null and supplier_order_id is not null;
