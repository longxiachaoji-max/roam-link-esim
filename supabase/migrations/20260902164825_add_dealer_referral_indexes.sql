create index if not exists idx_orders_dealer_referral_id
  on public.orders (dealer_referral_id);
create index if not exists idx_dealer_referral_commissions_payout_id
  on public.dealer_referral_commissions (payout_id);
create index if not exists idx_dealer_referral_payouts_reviewed_by
  on public.dealer_referral_payouts (reviewed_by);
