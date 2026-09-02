alter table public.dealers
  add column if not exists sales_mode text not null default 'direct',
  add column if not exists referral_code text,
  add column if not exists referral_discount_percent numeric(5, 2) not null default 3,
  add column if not exists referral_commission_mode text not null default 'percentage',
  add column if not exists referral_commission_value numeric(10, 2) not null default 3;

alter table public.dealers
  drop constraint if exists dealers_sales_mode_check,
  drop constraint if exists dealers_referral_discount_percent_check,
  drop constraint if exists dealers_referral_commission_mode_check,
  drop constraint if exists dealers_referral_commission_value_check;

alter table public.dealers
  add constraint dealers_sales_mode_check
    check (sales_mode in ('direct', 'referral')),
  add constraint dealers_referral_discount_percent_check
    check (referral_discount_percent >= 0 and referral_discount_percent < 100),
  add constraint dealers_referral_commission_mode_check
    check (referral_commission_mode in ('percentage', 'fixed')),
  add constraint dealers_referral_commission_value_check
    check (
      (referral_commission_mode = 'percentage' and referral_commission_value between 0 and 100)
      or (referral_commission_mode = 'fixed' and referral_commission_value between 0 and 100000)
    );

create unique index if not exists idx_dealers_referral_code_unique
  on public.dealers (upper(referral_code))
  where referral_code is not null;

alter table public.orders
  add column if not exists dealer_referral_id uuid references public.dealers(id) on delete set null,
  add column if not exists dealer_referral_code_snapshot text;

create table if not exists public.dealer_referral_payouts (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  amount integer not null check (amount >= 0),
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'rejected', 'cancelled')),
  dealer_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz
);

create table if not exists public.dealer_referral_commissions (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payout_id uuid references public.dealer_referral_payouts(id) on delete set null,
  code_snapshot text not null,
  original_amount integer not null check (original_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  paid_amount integer not null check (paid_amount >= 0),
  item_count integer not null default 1 check (item_count > 0),
  commission_mode text not null check (commission_mode in ('percentage', 'fixed')),
  commission_value numeric(10, 2) not null check (commission_value >= 0),
  commission_amount integer not null check (commission_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'requested', 'paid', 'cancelled')),
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dealer_referral_commissions_dealer_status
  on public.dealer_referral_commissions (dealer_id, status, created_at desc);
create index if not exists idx_dealer_referral_payouts_dealer_created
  on public.dealer_referral_payouts (dealer_id, requested_at desc);
create unique index if not exists idx_dealer_one_requested_referral_payout
  on public.dealer_referral_payouts (dealer_id)
  where status = 'requested';

alter table public.dealer_referral_commissions enable row level security;
alter table public.dealer_referral_payouts enable row level security;

revoke all on public.dealer_referral_commissions, public.dealer_referral_payouts
from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_referral_commissions, public.dealer_referral_payouts
to service_role;

drop trigger if exists update_dealer_referral_commissions_modtime on public.dealer_referral_commissions;
create trigger update_dealer_referral_commissions_modtime
before update on public.dealer_referral_commissions
for each row execute procedure public.update_modified_column();

create or replace function public.sync_dealer_referral_commission_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payout_id uuid;
  v_remaining integer;
begin
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID' then
    update public.dealer_referral_commissions
    set status = 'available', available_at = coalesce(available_at, now())
    where order_id = new.id and status = 'pending';
  elsif (new.payment_status = 'REFUNDED' or new.order_status = 'CANCELLED')
    and (old.payment_status is distinct from new.payment_status or old.order_status is distinct from new.order_status) then
    select payout_id into v_payout_id
    from public.dealer_referral_commissions
    where order_id = new.id and status = 'requested';

    update public.dealer_referral_commissions
    set status = 'cancelled', payout_id = null
    where order_id = new.id and status in ('pending', 'available', 'requested');

    if v_payout_id is not null then
      select coalesce(sum(commission_amount), 0) into v_remaining
      from public.dealer_referral_commissions
      where payout_id = v_payout_id and status = 'requested';

      update public.dealer_referral_payouts
      set amount = v_remaining,
          status = case when v_remaining = 0 then 'cancelled' else status end,
          reviewed_at = case when v_remaining = 0 then now() else reviewed_at end
      where id = v_payout_id and status = 'requested';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_dealer_referral_commission_status on public.orders;
create trigger sync_dealer_referral_commission_status
after update of payment_status, order_status on public.orders
for each row execute function public.sync_dealer_referral_commission_status();

create or replace function public.request_dealer_referral_payout(
  p_dealer_id uuid,
  p_dealer_note text default null
)
returns table (payout_id uuid, amount integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout_id uuid;
  v_amount integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;

  perform 1 from public.dealers
  where id = p_dealer_id and status = 'approved' and sales_mode = 'referral'
  for update;
  if not found then raise exception 'DEALER_NOT_ELIGIBLE'; end if;

  if exists (
    select 1 from public.dealer_referral_payouts
    where dealer_id = p_dealer_id and status = 'requested'
  ) then raise exception 'PAYOUT_ALREADY_REQUESTED'; end if;

  perform 1
  from public.dealer_referral_commissions
  where dealer_id = p_dealer_id and status = 'available'
  for update;

  select coalesce(sum(commission_amount), 0)::integer into v_amount
  from public.dealer_referral_commissions
  where dealer_id = p_dealer_id and status = 'available';
  if v_amount <= 0 then raise exception 'NO_AVAILABLE_COMMISSION'; end if;

  insert into public.dealer_referral_payouts (dealer_id, amount, dealer_note)
  values (p_dealer_id, v_amount, nullif(trim(p_dealer_note), ''))
  returning id into v_payout_id;

  update public.dealer_referral_commissions
  set status = 'requested', payout_id = v_payout_id
  where dealer_id = p_dealer_id and status = 'available';

  return query select v_payout_id, v_amount;
end;
$$;

create or replace function public.review_dealer_referral_payout(
  p_payout_id uuid,
  p_decision text,
  p_admin_user_id uuid,
  p_admin_note text default null
)
returns table (payout_id uuid, amount integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.dealer_referral_payouts%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('paid', 'rejected') then raise exception 'INVALID_DECISION'; end if;

  select * into v_payout from public.dealer_referral_payouts
  where id = p_payout_id for update;
  if not found or v_payout.status <> 'requested' then raise exception 'PAYOUT_ALREADY_REVIEWED'; end if;

  if p_decision = 'paid' then
    update public.dealer_referral_commissions as commission
    set status = 'paid', paid_at = now()
    where commission.payout_id = p_payout_id and commission.status = 'requested';
    update public.dealer_referral_payouts as payout
    set status = 'paid', paid_at = now(), reviewed_at = now(), reviewed_by = p_admin_user_id,
        admin_note = nullif(trim(p_admin_note), '')
    where payout.id = p_payout_id;
  else
    update public.dealer_referral_commissions as commission
    set status = 'available', payout_id = null
    where commission.payout_id = p_payout_id and commission.status = 'requested';
    update public.dealer_referral_payouts as payout
    set status = 'rejected', reviewed_at = now(), reviewed_by = p_admin_user_id,
        admin_note = nullif(trim(p_admin_note), '')
    where payout.id = p_payout_id;
  end if;

  return query select v_payout.id, v_payout.amount, p_decision;
end;
$$;

revoke all on function public.request_dealer_referral_payout(uuid, text) from public, anon, authenticated;
revoke all on function public.review_dealer_referral_payout(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.request_dealer_referral_payout(uuid, text) to service_role;
grant execute on function public.review_dealer_referral_payout(uuid, text, uuid, text) to service_role;
