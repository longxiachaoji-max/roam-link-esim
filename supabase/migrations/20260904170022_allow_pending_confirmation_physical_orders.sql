alter table public.physical_orders
  drop constraint if exists physical_orders_order_status_check;

alter table public.physical_orders
  add constraint physical_orders_order_status_check
  check (order_status in (
    'PENDING_PAYMENT',
    'PENDING_CONFIRMATION',
    'PROCESSING',
    'STOCK_ISSUE',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED'
  ));
