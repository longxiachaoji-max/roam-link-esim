-- 卡片指定要安裝到哪一張 eSIM 晶片（EID）；讀卡機 App 讀到 EID 後帶出對應的待安裝卡片
alter table public.order_items add column if not exists target_eid text;
alter table public.order_items drop constraint if exists order_items_target_eid_format;
alter table public.order_items add constraint order_items_target_eid_format check (target_eid is null or target_eid ~ '^89[0-9]{30}$');
create index if not exists order_items_target_eid_idx on public.order_items (target_eid) where target_eid is not null;
