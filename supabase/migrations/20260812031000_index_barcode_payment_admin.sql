create index if not exists idx_orders_manual_payment_confirmed_by
  on public.orders (manual_payment_confirmed_by)
  where manual_payment_confirmed_by is not null;
