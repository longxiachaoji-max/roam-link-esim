alter table public.physical_products
  add column if not exists rental_price_tiers jsonb not null default '[]'::jsonb;

alter table public.physical_products
  drop constraint if exists physical_products_rental_price_tiers_check;
alter table public.physical_products
  add constraint physical_products_rental_price_tiers_check
  check (jsonb_typeof(rental_price_tiers) = 'array');

create or replace function public.calculate_physical_rental_price(
  p_daily_rate numeric,
  p_price_tiers jsonb,
  p_days integer
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select round((tier->>'total')::numeric)
      from jsonb_array_elements(coalesce(p_price_tiers, '[]'::jsonb)) tier
      where (tier->>'days')::integer = p_days
        and (tier->>'total')::numeric >= 0
      limit 1
    ),
    round(p_daily_rate) * p_days
  );
$$;

revoke all on function public.calculate_physical_rental_price(numeric, jsonb, integer) from public, anon, authenticated;
grant execute on function public.calculate_physical_rental_price(numeric, jsonb, integer) to service_role;

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
      v_unit_price := public.calculate_physical_rental_price(
        v_product.price, v_product.rental_price_tiers, v_rental_days
      );
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
      v_unit_price := public.calculate_physical_rental_price(
        v_product.price, v_product.rental_price_tiers, v_rental_days
      );
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
