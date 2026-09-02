create table if not exists public.dealer_referral_codes (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dealer_referral_codes_code_not_blank check (length(trim(code)) >= 2)
);

create index if not exists idx_dealer_referral_codes_dealer_active
  on public.dealer_referral_codes (dealer_id, is_active, created_at);

alter table public.dealer_referral_codes enable row level security;
revoke all on public.dealer_referral_codes from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_referral_codes to service_role;

drop trigger if exists update_dealer_referral_codes_modtime on public.dealer_referral_codes;
create trigger update_dealer_referral_codes_modtime
before update on public.dealer_referral_codes
for each row execute procedure public.update_modified_column();

insert into public.dealer_referral_codes (dealer_id, code)
select id, referral_code
from public.dealers
where referral_code is not null and length(trim(referral_code)) >= 2
on conflict (code) do nothing;

alter table public.dealer_referral_payouts
  add column if not exists code_snapshot text;

update public.dealer_referral_payouts as payout
set code_snapshot = matched.code_snapshot
from (
  select payout_id, min(code_snapshot) as code_snapshot
  from public.dealer_referral_commissions
  where payout_id is not null
  group by payout_id
  having count(distinct code_snapshot) = 1
) as matched
where payout.id = matched.payout_id and payout.code_snapshot is null;

drop index if exists public.idx_dealer_one_requested_referral_payout;
create unique index if not exists idx_dealer_code_one_requested_referral_payout
  on public.dealer_referral_payouts (dealer_id, coalesce(upper(code_snapshot), ''))
  where status = 'requested';

drop function if exists public.request_dealer_referral_payout(uuid, text);
create function public.request_dealer_referral_payout(
  p_dealer_id uuid,
  p_code text,
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
  v_code text := upper(trim(p_code));
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;

  perform 1 from public.dealers
  where id = p_dealer_id and status = 'approved' and sales_mode = 'referral'
  for update;
  if not found then raise exception 'DEALER_NOT_ELIGIBLE'; end if;

  perform 1 from public.dealer_referral_codes
  where dealer_id = p_dealer_id and upper(code) = v_code and is_active = true
  for update;
  if not found then raise exception 'REFERRAL_CODE_NOT_FOUND'; end if;

  if exists (
    select 1 from public.dealer_referral_payouts
    where dealer_id = p_dealer_id and upper(code_snapshot) = v_code and status = 'requested'
  ) then raise exception 'PAYOUT_ALREADY_REQUESTED'; end if;

  perform 1
  from public.dealer_referral_commissions
  where dealer_id = p_dealer_id and upper(code_snapshot) = v_code and status = 'available'
  for update;

  select coalesce(sum(commission_amount), 0)::integer into v_amount
  from public.dealer_referral_commissions
  where dealer_id = p_dealer_id and upper(code_snapshot) = v_code and status = 'available';
  if v_amount <= 0 then raise exception 'NO_AVAILABLE_COMMISSION'; end if;

  insert into public.dealer_referral_payouts (dealer_id, code_snapshot, amount, dealer_note)
  values (p_dealer_id, v_code, v_amount, nullif(trim(p_dealer_note), ''))
  returning id into v_payout_id;

  update public.dealer_referral_commissions
  set status = 'requested', payout_id = v_payout_id
  where dealer_id = p_dealer_id and upper(code_snapshot) = v_code and status = 'available';

  return query select v_payout_id, v_amount;
end;
$$;

revoke all on function public.request_dealer_referral_payout(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.request_dealer_referral_payout(uuid, text, text)
to service_role;
