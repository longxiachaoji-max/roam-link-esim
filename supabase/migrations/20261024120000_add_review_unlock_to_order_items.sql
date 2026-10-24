-- 後台「允許評價」：沒有用量的 eSIM 也可以由管理員開放評價
alter table public.order_items
  add column if not exists review_unlocked_at timestamp with time zone;
