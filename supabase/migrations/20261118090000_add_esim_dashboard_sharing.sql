-- eSIM 管理頁：共享群組（輸入 Email 一起監控）與卡片分類分頁
create table if not exists public.esim_dashboard_members (
  id uuid primary key default gen_random_uuid(),
  owner_customer_id uuid not null references public.customers(id) on delete cascade,
  member_email text not null,
  created_at timestamp with time zone not null default now(),
  unique (owner_customer_id, member_email)
);
create index if not exists esim_dashboard_members_email_idx on public.esim_dashboard_members (member_email);
alter table public.esim_dashboard_members enable row level security;

create table if not exists public.esim_card_categories (
  id uuid primary key default gen_random_uuid(),
  owner_customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);
create index if not exists esim_card_categories_owner_idx on public.esim_card_categories (owner_customer_id, sort_order);
alter table public.esim_card_categories enable row level security;

create table if not exists public.esim_card_category_items (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  category_id uuid not null references public.esim_card_categories(id) on delete cascade,
  owner_customer_id uuid not null references public.customers(id) on delete cascade,
  updated_at timestamp with time zone not null default now()
);
create index if not exists esim_card_category_items_owner_idx on public.esim_card_category_items (owner_customer_id);
alter table public.esim_card_category_items enable row level security;
