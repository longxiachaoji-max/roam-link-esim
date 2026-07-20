alter table public.physical_orders
  add column if not exists rental_order_notified_at timestamptz;

alter table public.physical_order_items
  add column if not exists rental_start_reminder_sent_at timestamptz;

create index if not exists physical_order_items_pending_rental_reminder_idx
  on public.physical_order_items (rental_start_date, order_id)
  where rental_start_date is not null and rental_start_reminder_sent_at is null;

create or replace function public.claim_physical_rental_order_notification(p_order_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  update public.physical_orders physical_order
  set rental_order_notified_at = now()
  where physical_order.id = p_order_id
    and physical_order.payment_status = 'PAID'
    and physical_order.order_status not in ('CANCELLED', 'COMPLETED')
    and physical_order.rental_order_notified_at is null
    and exists (
      select 1
      from public.physical_order_items item
      where item.order_id = physical_order.id
        and item.rental_start_date is not null
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.claim_due_physical_rental_reminders(
  p_today date default (timezone('Asia/Taipei', now()))::date
)
returns table (order_item_id uuid, order_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with due_items as (
    select item.id
    from public.physical_order_items item
    join public.physical_orders physical_order on physical_order.id = item.order_id
    where item.rental_start_date between p_today and p_today + 5
      and item.rental_start_reminder_sent_at is null
      and physical_order.payment_status = 'PAID'
      and physical_order.order_status not in ('CANCELLED', 'COMPLETED')
    order by item.rental_start_date, item.id
    for update of item skip locked
    limit 250
  )
  update public.physical_order_items item
  set rental_start_reminder_sent_at = now()
  from due_items
  where item.id = due_items.id
  returning item.id, item.order_id;
end;
$$;

revoke all on function public.claim_physical_rental_order_notification(uuid) from public, anon, authenticated;
revoke all on function public.claim_due_physical_rental_reminders(date) from public, anon, authenticated;
grant execute on function public.claim_physical_rental_order_notification(uuid) to service_role;
grant execute on function public.claim_due_physical_rental_reminders(date) to service_role;
