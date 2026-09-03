alter table public.orders
  add column if not exists esim_delivery_email_status text not null default 'pending',
  add column if not exists esim_delivery_email_sent_at timestamp with time zone,
  add column if not exists esim_delivery_email_error text;

alter table public.orders
  drop constraint if exists orders_esim_delivery_email_status_check;

alter table public.orders
  add constraint orders_esim_delivery_email_status_check
  check (esim_delivery_email_status in ('pending', 'sending', 'sent', 'failed'));

create index if not exists idx_orders_pending_esim_delivery_email
  on public.orders (esim_delivery_email_status, updated_at)
  where payment_status = 'PAID' and order_status = 'COMPLETED';
