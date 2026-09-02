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

revoke all on function public.review_dealer_referral_payout(uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.review_dealer_referral_payout(uuid, text, uuid, text)
to service_role;
