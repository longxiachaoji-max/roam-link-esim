create or replace function public.prevent_referral_split_change_with_unrequested_commission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.customer_discount_percent is distinct from old.customer_discount_percent
    or new.owner_commission_percent is distinct from old.owner_commission_percent
  ) and exists (
    select 1
    from public.dealer_referral_commissions
    where dealer_id = old.dealer_id
      and upper(code_snapshot) = upper(old.code)
      and status in ('pending', 'available')
      and commission_amount > 0
  ) then
    raise exception 'UNREQUESTED_COMMISSION_EXISTS';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_referral_split_change_with_unrequested_commission
  on public.dealer_referral_codes;
create trigger prevent_referral_split_change_with_unrequested_commission
before update of customer_discount_percent, owner_commission_percent
on public.dealer_referral_codes
for each row execute function public.prevent_referral_split_change_with_unrequested_commission();
