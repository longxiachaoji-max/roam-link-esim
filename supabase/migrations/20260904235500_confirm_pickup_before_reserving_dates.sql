create or replace function public.prepare_cash_pickup_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_method = 'CASH_PICKUP' and new.payment_status = 'PENDING' then
    new.order_status := 'PENDING_CONFIRMATION';
    new.reservation_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_cash_pickup_order_before_insert on public.physical_orders;
create trigger prepare_cash_pickup_order_before_insert
before insert on public.physical_orders
for each row execute function public.prepare_cash_pickup_order();

create or replace function public.confirm_physical_pickup_reservation(p_order_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.physical_orders%rowtype;
  v_item public.physical_order_items%rowtype;
  v_stock integer;
  v_reserved integer;
  v_latest_end date;
  v_has_rental boolean := false;
begin
  select * into v_order
  from public.physical_orders
  where id = p_order_id
  for update;

  if not found then return 'NOT_FOUND'; end if;
  if v_order.payment_method <> 'CASH_PICKUP'
    or v_order.payment_status <> 'PENDING'
    or v_order.order_status <> 'PENDING_CONFIRMATION'
  then
    return 'INVALID_STATE';
  end if;

  perform product.id
  from public.physical_products product
  join public.physical_order_items item on item.product_id = product.id
  where item.order_id = p_order_id
  order by product.id
  for update of product;

  for v_item in
    select * from public.physical_order_items where order_id = p_order_id
  loop
    if v_item.rental_start_date is null or v_item.rental_end_date is null then
      continue;
    end if;
    v_has_rental := true;

    select stock_quantity into v_stock
    from public.physical_products
    where id = v_item.product_id and is_active = true;
    if not found then raise exception '% 已下架，無法成立訂單', v_item.product_name; end if;

    select coalesce(sum(other_item.quantity), 0)::integer into v_reserved
    from public.physical_order_items other_item
    join public.physical_orders other_order on other_order.id = other_item.order_id
    where other_item.product_id = v_item.product_id
      and other_item.order_id <> p_order_id
      and other_item.rental_start_date <= v_item.rental_end_date
      and other_item.rental_end_date >= v_item.rental_start_date
      and other_order.order_status not in ('CANCELLED', 'STOCK_ISSUE', 'PENDING_CONFIRMATION')
      and other_order.payment_status not in ('FAILED', 'REFUNDED')
      and (
        other_order.payment_status = 'PAID'
        or (other_order.payment_status = 'PENDING' and other_order.reservation_expires_at > now())
      );

    if v_reserved + v_item.quantity > v_stock then
      raise exception '% 選擇的日期已被其他訂單保留，請聯絡客戶改選日期', v_item.product_name;
    end if;
    v_latest_end := greatest(coalesce(v_latest_end, v_item.rental_end_date), v_item.rental_end_date);
  end loop;

  if not v_has_rental then return 'NO_RENTAL'; end if;

  update public.physical_orders
  set order_status = 'PROCESSING',
      reservation_expires_at = ((v_latest_end + 1)::timestamp at time zone 'Asia/Taipei') - interval '1 second',
      updated_at = now()
  where id = p_order_id;

  return 'PROCESSING';
end;
$$;

revoke all on function public.confirm_physical_pickup_reservation(uuid) from public, anon, authenticated;
grant execute on function public.confirm_physical_pickup_reservation(uuid) to service_role;
