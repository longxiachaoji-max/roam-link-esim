create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  smoothness_rating smallint not null check (smoothness_rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 2 and 1000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_reviews_visible_product_idx
  on public.product_reviews (product_id, created_at desc)
  where is_visible = true;

create index if not exists product_reviews_customer_idx
  on public.product_reviews (customer_id, created_at desc);

drop trigger if exists update_product_reviews_modtime on public.product_reviews;
create trigger update_product_reviews_modtime
before update on public.product_reviews
for each row execute procedure public.update_modified_column();

alter table public.product_reviews enable row level security;

drop policy if exists "Members read own product reviews" on public.product_reviews;
create policy "Members read own product reviews"
on public.product_reviews for select to authenticated
using (customer_id = (select private.current_customer_id()));

drop policy if exists "Members create verified product reviews" on public.product_reviews;
create policy "Members create verified product reviews"
on public.product_reviews for insert to authenticated
with check (
  customer_id = (select private.current_customer_id())
  and exists (
    select 1
    from public.order_items
    join public.orders on orders.id = order_items.order_id
    where order_items.id = product_reviews.order_item_id
      and order_items.order_id = product_reviews.order_id
      and order_items.product_id = product_reviews.product_id
      and orders.customer_id = product_reviews.customer_id
      and orders.payment_status = 'PAID'
      and orders.order_status = 'COMPLETED'
  )
);

drop policy if exists "Members update own product reviews" on public.product_reviews;
create policy "Members update own product reviews"
on public.product_reviews for update to authenticated
using (customer_id = (select private.current_customer_id()))
with check (
  customer_id = (select private.current_customer_id())
  and exists (
    select 1
    from public.order_items
    join public.orders on orders.id = order_items.order_id
    where order_items.id = product_reviews.order_item_id
      and order_items.order_id = product_reviews.order_id
      and order_items.product_id = product_reviews.product_id
      and orders.customer_id = product_reviews.customer_id
      and orders.payment_status = 'PAID'
      and orders.order_status = 'COMPLETED'
  )
);

drop policy if exists "Admins manage product reviews" on public.product_reviews;
create policy "Admins manage product reviews"
on public.product_reviews for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.product_reviews from anon, authenticated;
grant select, insert, update on public.product_reviews to authenticated;
