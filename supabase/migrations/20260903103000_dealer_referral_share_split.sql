alter table public.dealers
  add column if not exists referral_share_percent numeric(5, 2) not null default 30;

alter table public.dealers
  drop constraint if exists dealers_referral_share_percent_check,
  add constraint dealers_referral_share_percent_check
    check (referral_share_percent >= 0 and referral_share_percent <= 30);

alter table public.dealer_referral_codes
  add column if not exists customer_discount_percent numeric(5, 2) not null default 0,
  add column if not exists owner_commission_percent numeric(5, 2) not null default 0;

alter table public.dealer_referral_codes
  drop constraint if exists dealer_referral_codes_customer_discount_check,
  drop constraint if exists dealer_referral_codes_owner_commission_check,
  drop constraint if exists dealer_referral_codes_split_check,
  add constraint dealer_referral_codes_customer_discount_check
    check (customer_discount_percent >= 0 and customer_discount_percent <= 30),
  add constraint dealer_referral_codes_owner_commission_check
    check (owner_commission_percent >= 0 and owner_commission_percent <= 30),
  add constraint dealer_referral_codes_split_check
    check (customer_discount_percent + owner_commission_percent <= 30);

update public.dealers
set referral_share_percent = least(30, greatest(0,
  referral_discount_percent + case when referral_commission_mode = 'percentage' then referral_commission_value else 0 end
))
where sales_mode = 'referral';

update public.dealer_referral_codes as code
set customer_discount_percent = least(30, greatest(0, dealer.referral_discount_percent)),
    owner_commission_percent = least(
      greatest(0, 30 - least(30, greatest(0, dealer.referral_discount_percent))),
      case when dealer.referral_commission_mode = 'percentage' then greatest(0, dealer.referral_commission_value) else 0 end
    )
from public.dealers as dealer
where dealer.id = code.dealer_id;

create or replace function public.clamp_dealer_referral_code_splits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.referral_share_percent < old.referral_share_percent then
    update public.dealer_referral_codes
    set customer_discount_percent = least(customer_discount_percent, new.referral_share_percent),
        owner_commission_percent = least(
          owner_commission_percent,
          greatest(0, new.referral_share_percent - least(customer_discount_percent, new.referral_share_percent))
        )
    where dealer_id = new.id
      and customer_discount_percent + owner_commission_percent > new.referral_share_percent;
  end if;
  return new;
end;
$$;

drop trigger if exists clamp_dealer_referral_code_splits on public.dealers;
create trigger clamp_dealer_referral_code_splits
after update of referral_share_percent on public.dealers
for each row execute function public.clamp_dealer_referral_code_splits();
