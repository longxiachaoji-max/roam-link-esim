create table if not exists public.physical_product_reviews (
  id uuid primary key default gen_random_uuid(),
  physical_order_item_id uuid not null unique references public.physical_order_items(id) on delete cascade,
  physical_order_id uuid not null references public.physical_orders(id) on delete cascade,
  physical_product_id uuid references public.physical_products(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 2 and 1000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_product_reviews_visible_product_idx
  on public.physical_product_reviews (physical_product_id, created_at desc)
  where is_visible = true;
create index if not exists physical_product_reviews_customer_idx
  on public.physical_product_reviews (customer_id, created_at desc);
create index if not exists physical_product_reviews_order_idx
  on public.physical_product_reviews (physical_order_id);

drop trigger if exists update_physical_product_reviews_modtime on public.physical_product_reviews;
create trigger update_physical_product_reviews_modtime
before update on public.physical_product_reviews
for each row execute procedure public.update_modified_column();

alter table public.physical_product_reviews enable row level security;

drop policy if exists "Admins manage physical product reviews" on public.physical_product_reviews;
create policy "Admins manage physical product reviews"
on public.physical_product_reviews for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.physical_product_reviews from anon, authenticated;
grant select, insert, update, delete on public.physical_product_reviews to authenticated;
