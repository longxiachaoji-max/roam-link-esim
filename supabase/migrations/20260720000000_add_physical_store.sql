-- Physical products are kept separate from eSIM plans and fulfillment.
create table if not exists public.physical_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'travel_card'
    check (category in ('rental', 'travel_card', 'other')),
  summary text,
  description text,
  rental_terms text,
  price numeric(10, 2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  images text[] not null default '{}',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_products_active_sort_idx
  on public.physical_products (is_active, category, sort_order, created_at desc);

create table if not exists public.physical_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  customer_email text not null,
  recipient_name text not null,
  recipient_phone text not null,
  postal_code text,
  shipping_address text not null,
  shipping_note text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  shipping_fee numeric(10, 2) not null default 0 check (shipping_fee >= 0),
  total_amount numeric(10, 2) not null check (total_amount > 0),
  payment_method text not null default 'ECPAY',
  payment_status text not null default 'PENDING'
    check (payment_status in ('PENDING', 'PAID', 'REFUNDED', 'FAILED')),
  order_status text not null default 'PENDING_PAYMENT'
    check (order_status in ('PENDING_PAYMENT', 'PROCESSING', 'STOCK_ISSUE', 'SHIPPED', 'COMPLETED', 'CANCELLED')),
  ecpay_trade_no text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_orders_customer_created_idx
  on public.physical_orders (customer_id, created_at desc);
create index if not exists physical_orders_status_created_idx
  on public.physical_orders (payment_status, order_status, created_at desc);

create table if not exists public.physical_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.physical_orders(id) on delete cascade,
  product_id uuid references public.physical_products(id) on delete set null,
  product_name text not null,
  product_image text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists physical_order_items_order_idx
  on public.physical_order_items (order_id);

drop trigger if exists update_physical_products_modtime on public.physical_products;
create trigger update_physical_products_modtime
  before update on public.physical_products
  for each row execute procedure public.update_modified_column();

drop trigger if exists update_physical_orders_modtime on public.physical_orders;
create trigger update_physical_orders_modtime
  before update on public.physical_orders
  for each row execute procedure public.update_modified_column();

alter table public.physical_products enable row level security;
alter table public.physical_orders enable row level security;
alter table public.physical_order_items enable row level security;

grant all on table public.physical_products to service_role;
grant all on table public.physical_orders to service_role;
grant all on table public.physical_order_items to service_role;
revoke all on table public.physical_products from anon, authenticated;
revoke all on table public.physical_orders from anon, authenticated;
revoke all on table public.physical_order_items from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'physical-products',
  'physical-products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
