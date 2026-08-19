create index if not exists idx_orders_promo_code_id
  on public.orders (promo_code_id)
  where promo_code_id is not null;

create index if not exists idx_promo_redemptions_promo_code_id
  on public.promo_redemptions (promo_code_id);
