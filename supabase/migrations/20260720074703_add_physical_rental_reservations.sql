alter table public.physical_orders
  add column if not exists reservation_expires_at timestamptz;

alter table public.physical_order_items
  add column if not exists rental_start_date date,
  add column if not exists rental_end_date date,
  add column if not exists rental_days integer,
  add column if not exists rental_daily_rate numeric(10, 2);

alter table public.physical_order_items
  drop constraint if exists physical_order_items_rental_dates_check;
alter table public.physical_order_items
  add constraint physical_order_items_rental_dates_check check (
    (rental_start_date is null and rental_end_date is null and rental_days is null and rental_daily_rate is null)
    or (
      rental_start_date is not null
      and rental_end_date is not null
      and rental_end_date >= rental_start_date
      and rental_days = rental_end_date - rental_start_date + 1
      and rental_days > 0
      and rental_daily_rate >= 0
    )
  );

create index if not exists physical_order_items_rental_period_idx
  on public.physical_order_items (product_id, rental_start_date, rental_end_date)
  where rental_start_date is not null;

create index if not exists physical_orders_active_reservation_idx
  on public.physical_orders (payment_status, order_status, reservation_expires_at);

create or replace function public.get_physical_rental_availability(
  p_product_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (reserved_date date, reserved_quantity bigint)
language sql
security invoker
set search_path = ''
as $$
  select day_value::date as reserved_date, sum(item.quantity)::bigint as reserved_quantity
  from public.physical_order_items item
  join public.physical_orders physical_order on physical_order.id = item.order_id
  cross join lateral generate_series(
    greatest(item.rental_start_date, p_from_date)::timestamp,
    least(item.rental_end_date, p_to_date)::timestamp,
    interval '1 day'
  ) as day_value
  where item.product_id = p_product_id
    and item.rental_start_date is not null
    and item.rental_end_date is not null
    and item.rental_start_date <= p_to_date
    and item.rental_end_date >= p_from_date
    and physical_order.order_status not in ('CANCELLED', 'STOCK_ISSUE')
    and physical_order.payment_status not in ('FAILED', 'REFUNDED')
    and (
      physical_order.payment_status = 'PAID'
      or (
        physical_order.payment_status = 'PENDING'
        and physical_order.reservation_expires_at > now()
      )
    )
  group by day_value::date
  order by day_value::date;
$$;

revoke all on function public.get_physical_rental_availability(uuid, date, date) from public, anon, authenticated;
grant execute on function public.get_physical_rental_availability(uuid, date, date) to service_role;

create or replace function public.create_physical_order_with_items(
  p_order jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product public.physical_products%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_start_date date;
  v_end_date date;
  v_rental_days integer;
  v_reserved_quantity integer;
  v_unit_price numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '購物車內容不正確';
  end if;

  -- Lock products in a stable order so concurrent checkouts cannot reserve the
  -- same remaining rental capacity at the same time.
  perform product.id
  from public.physical_products product
  where product.id in (
    select (value->>'product_id')::uuid from jsonb_array_elements(p_items)
  )
  order by product.id
  for update;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 20 then
      raise exception '商品數量不正確';
    end if;

    select * into v_product
    from public.physical_products
    where id = v_product_id and is_active = true;
    if not found then
      raise exception '部分商品已下架，請重新整理購物車';
    end if;

    if v_product.category = 'rental' then
      v_start_date := (v_item->>'rental_start_date')::date;
      v_end_date := (v_item->>'rental_end_date')::date;
      if v_start_date is null or v_end_date is null or v_start_date < current_date or v_end_date < v_start_date then
        raise exception '% 的租借日期不正確', v_product.name;
      end if;
      v_rental_days := v_end_date - v_start_date + 1;

      select coalesce(sum(item.quantity), 0)::integer into v_reserved_quantity
      from public.physical_order_items item
      join public.physical_orders physical_order on physical_order.id = item.order_id
      where item.product_id = v_product.id
        and item.rental_start_date <= v_end_date
        and item.rental_end_date >= v_start_date
        and physical_order.order_status not in ('CANCELLED', 'STOCK_ISSUE')
        and physical_order.payment_status not in ('FAILED', 'REFUNDED')
        and (
          physical_order.payment_status = 'PAID'
          or (
            physical_order.payment_status = 'PENDING'
            and physical_order.reservation_expires_at > now()
          )
        );

      if v_reserved_quantity + v_quantity > v_product.stock_quantity then
        raise exception '% 選擇的日期已被預約，請重新選擇', v_product.name;
      end if;
      v_unit_price := round(v_product.price) * v_rental_days;
    else
      v_start_date := null;
      v_end_date := null;
      v_rental_days := null;
      if v_product.stock_quantity < v_quantity then
        raise exception '% 庫存不足', v_product.name;
      end if;
      v_unit_price := round(v_product.price);
    end if;

    v_subtotal := v_subtotal + v_unit_price * v_quantity;
  end loop;

  if v_subtotal <= 0 or v_subtotal <> (p_order->>'subtotal')::numeric then
    raise exception '訂單金額不正確';
  end if;

  insert into public.physical_orders (
    customer_id, customer_email, recipient_name, recipient_phone, postal_code,
    shipping_address, shipping_note, subtotal, shipping_fee, total_amount,
    payment_method, payment_status, order_status, ecpay_trade_no,
    reservation_expires_at
  ) values (
    (p_order->>'customer_id')::uuid,
    p_order->>'customer_email',
    p_order->>'recipient_name',
    p_order->>'recipient_phone',
    nullif(p_order->>'postal_code', ''),
    p_order->>'shipping_address',
    nullif(p_order->>'shipping_note', ''),
    v_subtotal,
    coalesce((p_order->>'shipping_fee')::numeric, 0),
    v_subtotal + coalesce((p_order->>'shipping_fee')::numeric, 0),
    p_order->>'payment_method',
    'PENDING',
    'PENDING_PAYMENT',
    p_order->>'ecpay_trade_no',
    (p_order->>'reservation_expires_at')::timestamptz
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.physical_products where id = v_product_id;

    if v_product.category = 'rental' then
      v_start_date := (v_item->>'rental_start_date')::date;
      v_end_date := (v_item->>'rental_end_date')::date;
      v_rental_days := v_end_date - v_start_date + 1;
      v_unit_price := round(v_product.price) * v_rental_days;
    else
      v_start_date := null;
      v_end_date := null;
      v_rental_days := null;
      v_unit_price := round(v_product.price);
    end if;

    insert into public.physical_order_items (
      order_id, product_id, product_name, product_image, quantity, unit_price,
      rental_start_date, rental_end_date, rental_days, rental_daily_rate
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.images[1], v_quantity,
      v_unit_price, v_start_date, v_end_date, v_rental_days,
      case when v_product.category = 'rental' then round(v_product.price) else null end
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_physical_order_with_items(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_physical_order_with_items(jsonb, jsonb) to service_role;

create or replace function public.mark_physical_order_paid(
  p_order_id uuid,
  p_paid_amount numeric
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.physical_orders%rowtype;
  v_item public.physical_order_items%rowtype;
  v_product public.physical_products%rowtype;
  v_updated_count integer;
  v_reserved_quantity integer;
  v_stock_issue boolean := false;
begin
  select * into v_order
  from public.physical_orders
  where id = p_order_id
  for update;

  if not found then return 'NOT_FOUND'; end if;
  if v_order.total_amount <> p_paid_amount then return 'AMOUNT_MISMATCH'; end if;
  if v_order.payment_status = 'PAID' then return v_order.order_status; end if;

  for v_item in select * from public.physical_order_items where order_id = p_order_id
  loop
    if v_item.product_id is null then
      v_stock_issue := true;
      continue;
    end if;

    select * into v_product
    from public.physical_products
    where id = v_item.product_id
    for update;

    if v_product.category = 'rental' then
      select coalesce(sum(item.quantity), 0)::integer into v_reserved_quantity
      from public.physical_order_items item
      join public.physical_orders physical_order on physical_order.id = item.order_id
      where item.product_id = v_item.product_id
        and item.order_id <> p_order_id
        and item.rental_start_date <= v_item.rental_end_date
        and item.rental_end_date >= v_item.rental_start_date
        and physical_order.order_status not in ('CANCELLED', 'STOCK_ISSUE')
        and physical_order.payment_status not in ('FAILED', 'REFUNDED')
        and (
          physical_order.payment_status = 'PAID'
          or (
            physical_order.payment_status = 'PENDING'
            and physical_order.reservation_expires_at > now()
          )
        );
      if v_reserved_quantity + v_item.quantity > v_product.stock_quantity then
        v_stock_issue := true;
      end if;
    else
      update public.physical_products
      set stock_quantity = stock_quantity - v_item.quantity
      where id = v_item.product_id and stock_quantity >= v_item.quantity;
      get diagnostics v_updated_count = row_count;
      if v_updated_count = 0 then v_stock_issue := true; end if;
    end if;
  end loop;

  update public.physical_orders
  set payment_status = 'PAID',
      order_status = case when v_stock_issue then 'STOCK_ISSUE' else 'PROCESSING' end,
      reservation_expires_at = null,
      updated_at = now()
  where id = p_order_id;

  return case when v_stock_issue then 'STOCK_ISSUE' else 'PROCESSING' end;
end;
$$;

revoke all on function public.mark_physical_order_paid(uuid, numeric) from public, anon, authenticated;
grant execute on function public.mark_physical_order_paid(uuid, numeric) to service_role;
