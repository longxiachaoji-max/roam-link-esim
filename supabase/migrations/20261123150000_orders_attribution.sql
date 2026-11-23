-- 訂單來源（客人從哪裡進站）：attribution = { first, last } 進站資訊；source_channel = 歸類後的管道名稱
alter table public.orders add column if not exists attribution jsonb;
alter table public.orders add column if not exists source_channel text;
create index if not exists orders_source_channel_idx on public.orders (source_channel) where source_channel is not null;
