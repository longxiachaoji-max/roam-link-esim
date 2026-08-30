drop function if exists public.cancel_dealer_order(uuid);

create function public.cancel_dealer_order(
  p_order_id uuid,
  p_reclaim_inventory_ids uuid[] default '{}'::uuid[]
)
returns table (
  cancelled boolean,
  refunded_amount integer,
  new_balance integer,
  reclaimed_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_dealer_order public.dealer_orders%rowtype;
  v_new_balance integer;
  v_inventory_id uuid;
  v_reclaimed_count integer := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select * into v_dealer_order
  from public.dealer_orders
  where fulfillment_order_id = p_order_id;

  if not found then
    raise exception 'NOT_DEALER_ORDER';
  end if;

  select balance into v_new_balance
  from public.dealers
  where id = v_dealer_order.dealer_id
  for update;

  if v_order.order_status = 'CANCELLED' then
    return query select false, 0, v_new_balance, 0;
    return;
  end if;

  for v_inventory_id in
    select inventory.id
    from public.order_items item
    join public.e_sim_inventory inventory on inventory.id = item.inventory_id
    where item.order_id = p_order_id
      and inventory.id = any(coalesce(p_reclaim_inventory_ids, '{}'::uuid[]))
      and inventory.microesim_usage_cache ->> 'status' = '尚未安裝'
    for update of item, inventory
  loop
    update public.order_items
    set inventory_id = null
    where order_id = p_order_id
      and inventory_id = v_inventory_id;

    update public.e_sim_inventory
    set status = 'AVAILABLE',
        sold_at = null
    where id = v_inventory_id;

    v_reclaimed_count := v_reclaimed_count + 1;
  end loop;

  update public.dealers
  set balance = balance + v_dealer_order.dealer_total
  where id = v_dealer_order.dealer_id
  returning balance into v_new_balance;

  insert into public.dealer_balance_transactions (
    dealer_id,
    amount,
    balance_after,
    transaction_type,
    reason,
    dealer_order_id
  ) values (
    v_dealer_order.dealer_id,
    v_dealer_order.dealer_total,
    v_new_balance,
    'refund',
    '取消代客 eSIM 訂單退款（訂單 ' || coalesce(v_order.order_number, p_order_id::text) || '）',
    v_dealer_order.id
  );

  update public.orders
  set order_status = 'CANCELLED',
      payment_status = 'REFUNDED',
      updated_at = now()
  where id = p_order_id;

  return query select true, v_dealer_order.dealer_total, v_new_balance, v_reclaimed_count;
end;
$$;

revoke execute on function public.cancel_dealer_order(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.cancel_dealer_order(uuid, uuid[]) to service_role;
