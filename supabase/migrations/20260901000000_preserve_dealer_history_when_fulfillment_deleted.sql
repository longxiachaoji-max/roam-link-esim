alter table public.dealer_orders
  alter column fulfillment_order_id drop not null;

alter table public.dealer_orders
  drop constraint if exists dealer_orders_fulfillment_order_id_fkey;

alter table public.dealer_orders
  add constraint dealer_orders_fulfillment_order_id_fkey
  foreign key (fulfillment_order_id)
  references public.orders(id)
  on delete set null;

alter table public.dealer_order_items
  alter column order_item_id drop not null;

alter table public.dealer_order_items
  drop constraint if exists dealer_order_items_order_item_id_fkey;

alter table public.dealer_order_items
  add constraint dealer_order_items_order_item_id_fkey
  foreign key (order_item_id)
  references public.order_items(id)
  on delete set null;
