-- 改為「逐張共享 eSIM 卡」：擁有者把指定卡片共享給 Email，分類由每個人自己管理
create table if not exists public.esim_card_shares (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  member_email text not null,
  owner_customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (order_item_id, member_email)
);
create index if not exists esim_card_shares_member_idx on public.esim_card_shares (member_email);
create index if not exists esim_card_shares_owner_idx on public.esim_card_shares (owner_customer_id);
alter table public.esim_card_shares enable row level security;

-- 分類歸屬改成「誰建立就是誰的」，同一張卡在不同人的分類可以不同
alter table public.esim_card_category_items drop constraint if exists esim_card_category_items_pkey;
alter table public.esim_card_category_items add primary key (owner_customer_id, order_item_id);

-- 整頁共享的設計不再使用
drop table if exists public.esim_dashboard_members;
