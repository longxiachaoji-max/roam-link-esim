create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

insert into public.admin_users (user_id, email)
select id, lower(email)
from auth.users
where lower(email) = 'j800825j@gmail.com'
on conflict (user_id) do update set email = excluded.email;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.customers
  where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  limit 1;
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.current_customer_id() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_customer_id() to authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.e_sim_inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.site_settings enable row level security;
alter table public.token_transactions enable row level security;

drop policy if exists "Admins manage admin users" on public.admin_users;
create policy "Admins manage admin users"
on public.admin_users for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Members read own profile" on public.customers;
create policy "Members read own profile"
on public.customers for select to authenticated
using (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

drop policy if exists "Members create own profile" on public.customers;
create policy "Members create own profile"
on public.customers for insert to authenticated
with check (lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

drop policy if exists "Admins manage customers" on public.customers;
create policy "Admins manage customers"
on public.customers for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Members read own orders" on public.orders;
create policy "Members read own orders"
on public.orders for select to authenticated
using (customer_id = (select private.current_customer_id()));

drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders"
on public.orders for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Members read own order items" on public.order_items;
create policy "Members read own order items"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and orders.customer_id = (select private.current_customer_id())
));

drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items"
on public.order_items for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Members read own eSIM" on public.e_sim_inventory;
create policy "Members read own eSIM"
on public.e_sim_inventory for select to authenticated
using (exists (
  select 1
  from public.order_items
  join public.orders on orders.id = order_items.order_id
  where order_items.inventory_id = e_sim_inventory.id
    and orders.customer_id = (select private.current_customer_id())
));

drop policy if exists "Admins manage eSIM inventory" on public.e_sim_inventory;
create policy "Admins manage eSIM inventory"
on public.e_sim_inventory for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Users can view their own token transactions" on public.token_transactions;
drop policy if exists "Members read own token transactions" on public.token_transactions;
create policy "Members read own token transactions"
on public.token_transactions for select to authenticated
using (customer_id = (select private.current_customer_id()));

drop policy if exists "Admins manage token transactions" on public.token_transactions;
create policy "Admins manage token transactions"
on public.token_transactions for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins manage promo codes"
on public.promo_codes for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage promo redemptions" on public.promo_redemptions;
create policy "Admins manage promo redemptions"
on public.promo_redemptions for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
on public.site_settings for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage physical products" on public.physical_products;
create policy "Admins manage physical products"
on public.physical_products for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage physical orders" on public.physical_orders;
create policy "Admins manage physical orders"
on public.physical_orders for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins manage physical order items" on public.physical_order_items;
create policy "Admins manage physical order items"
on public.physical_order_items for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.admin_users, public.customers, public.products, public.orders,
  public.order_items, public.e_sim_inventory, public.token_transactions,
  public.promo_codes, public.promo_redemptions, public.site_settings,
  public.physical_products, public.physical_orders, public.physical_order_items
from anon;

revoke all on public.admin_users, public.customers, public.products, public.orders,
  public.order_items, public.e_sim_inventory, public.token_transactions,
  public.promo_codes, public.promo_redemptions, public.site_settings,
  public.physical_products, public.physical_orders, public.physical_order_items
from authenticated;

grant select on public.admin_users to authenticated;
grant select, insert on public.customers to authenticated;
grant select on public.products, public.orders, public.order_items,
  public.e_sim_inventory, public.token_transactions to authenticated;
