create index if not exists product_reviews_order_idx
  on public.product_reviews (order_id);

drop policy if exists "Members read own product reviews" on public.product_reviews;
drop policy if exists "Members create verified product reviews" on public.product_reviews;
drop policy if exists "Members update own product reviews" on public.product_reviews;

revoke all on public.product_reviews from anon, authenticated;
grant select, insert, update, delete on public.product_reviews to authenticated;
