create table if not exists public.physical_store_settings (
  id text primary key default 'main' check (id = 'main'),
  shipping_fee integer not null default 110 check (shipping_fee >= 0),
  free_shipping_enabled boolean not null default true,
  free_shipping_threshold integer not null default 1500 check (free_shipping_threshold >= 0),
  rental_free_shipping_enabled boolean not null default true,
  rental_free_shipping_days integer not null default 3 check (rental_free_shipping_days > 0),
  pickup_enabled boolean not null default true,
  pickup_label text not null default '新北板橋面交',
  pickup_instructions text not null default '面交需先預約確認時間',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.physical_store_settings (id)
values ('main')
on conflict (id) do nothing;

drop trigger if exists update_physical_store_settings_modtime on public.physical_store_settings;
create trigger update_physical_store_settings_modtime
  before update on public.physical_store_settings
  for each row execute procedure public.update_modified_column();

alter table public.physical_store_settings enable row level security;
revoke all on table public.physical_store_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.physical_store_settings to service_role;

alter table public.physical_orders
  add column if not exists delivery_method text not null default 'shipping';
alter table public.physical_orders
  drop constraint if exists physical_orders_delivery_method_check;
alter table public.physical_orders
  add constraint physical_orders_delivery_method_check
  check (delivery_method in ('shipping', 'pickup'));

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
  with applicable_tier as (
    select
      tier,
      (tier->>'days')::integer as tier_days
    from jsonb_array_elements(coalesce(p_price_tiers, '[]'::jsonb)) tier
    where (tier->>'days')::integer <= p_days
    order by (tier->>'days')::integer desc
    limit 1
  )
  select coalesce(
    (
      select case
        when tier->>'mode' = 'discount'
          then round(p_daily_rate * p_days * (100 - (tier->>'discount')::numeric) / 100)
        else round((tier->>'total')::numeric * p_days / tier_days)
      end
      from applicable_tier
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
  v_settings public.physical_store_settings%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_start_date date;
  v_end_date date;
  v_rental_days integer;
  v_max_rental_days integer := 0;
  v_reserved_quantity integer;
  v_unit_price numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_shipping_fee numeric(10, 2);
  v_total numeric(10, 2);
  v_payment_method text := p_order->>'payment_method';
  v_delivery_method text := coalesce(nullif(p_order->>'delivery_method', ''), 'shipping');
  v_customer_id uuid := (p_order->>'customer_id')::uuid;
  v_balance integer;
  v_new_balance integer;
  v_is_token_payment boolean;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '購物車內容不正確';
  end if;
  if v_payment_method not in ('ECPAY_CREDIT', 'ECPAY_BARCODE', 'TOKENS') then
    raise exception '付款方式不正確';
  end if;
  if v_delivery_method not in ('shipping', 'pickup') then
    raise exception '配送方式不正確';
  end if;
  v_is_token_payment := v_payment_method = 'TOKENS';

  select * into v_settings
  from public.physical_store_settings
  where id = 'main';
  if not found then raise exception '商城配送設定不存在'; end if;
  if v_delivery_method = 'pickup' and not v_settings.pickup_enabled then
    raise exception '目前未開放面交，請選擇宅配';
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
    if v_quantity < 1 or v_quantity > 20 then raise exception '商品數量不正確'; end if;

    select * into v_product
    from public.physical_products
    where id = v_product_id and is_active = true;
    if not found then raise exception '部分商品已下架，請重新整理購物車'; end if;

    if v_product.category = 'rental' then
      if v_payment_method = 'ECPAY_BARCODE' then
        raise exception '租借商品不開放超商條碼直接結帳，請先儲值後使用儲值金付款';
      end if;
      v_start_date := (v_item->>'rental_start_date')::date;
      v_end_date := (v_item->>'rental_end_date')::date;
      if v_start_date is null or v_end_date is null or v_start_date < current_date or v_end_date < v_start_date then
        raise exception '% 的租借日期不正確', v_product.name;
      end if;
      v_rental_days := v_end_date - v_start_date + 1;
      v_max_rental_days := greatest(v_max_rental_days, v_rental_days);

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
          or (physical_order.payment_status = 'PENDING' and physical_order.reservation_expires_at > now())
        );
      if v_reserved_quantity + v_quantity > v_product.stock_quantity then
        raise exception '% 選擇的日期已被預約，請重新選擇', v_product.name;
      end if;
      v_unit_price := public.calculate_physical_rental_price(v_product.price, v_product.rental_price_tiers, v_rental_days);
    else
      v_start_date := null;
      v_end_date := null;
      v_rental_days := null;
      if v_product.stock_quantity < v_quantity then raise exception '% 庫存不足', v_product.name; end if;
      v_unit_price := round(v_product.price);
    end if;
    v_subtotal := v_subtotal + v_unit_price * v_quantity;
  end loop;

  if v_subtotal <= 0 or v_subtotal <> (p_order->>'subtotal')::numeric or v_subtotal <> round(v_subtotal) then
    raise exception '訂單金額不正確';
  end if;

  if v_delivery_method = 'pickup'
    or (v_settings.free_shipping_enabled and v_subtotal >= v_settings.free_shipping_threshold)
    or (v_settings.rental_free_shipping_enabled and v_max_rental_days >= v_settings.rental_free_shipping_days)
  then
    v_shipping_fee := 0;
  else
    v_shipping_fee := v_settings.shipping_fee;
  end if;
  if v_shipping_fee <> coalesce((p_order->>'shipping_fee')::numeric, 0) then
    raise exception '運費已更新，請重新整理後再結帳';
  end if;
  v_total := v_subtotal + v_shipping_fee;

  if v_is_token_payment then
    select token_balance into v_balance from public.customers where id = v_customer_id for update;
    if not found then raise exception '找不到會員資料'; end if;
    if coalesce(v_balance, 0) < v_total then raise exception '儲值金餘額不足，請先完成儲值'; end if;
    v_new_balance := v_balance - v_total::integer;
  end if;

  insert into public.physical_orders (
    customer_id, customer_email, recipient_name, recipient_phone, postal_code,
    shipping_address, shipping_note, delivery_method, subtotal, shipping_fee, total_amount,
    payment_method, payment_status, order_status, ecpay_trade_no, reservation_expires_at
  ) values (
    v_customer_id, p_order->>'customer_email', p_order->>'recipient_name', p_order->>'recipient_phone',
    nullif(p_order->>'postal_code', ''), p_order->>'shipping_address', nullif(p_order->>'shipping_note', ''),
    v_delivery_method, v_subtotal, v_shipping_fee, v_total, v_payment_method,
    case when v_is_token_payment then 'PAID' else 'PENDING' end,
    case when v_is_token_payment then 'PROCESSING' else 'PENDING_PAYMENT' end,
    nullif(p_order->>'ecpay_trade_no', ''),
    case when v_is_token_payment then null else (p_order->>'reservation_expires_at')::timestamptz end
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
      v_unit_price := public.calculate_physical_rental_price(v_product.price, v_product.rental_price_tiers, v_rental_days);
    else
      v_start_date := null;
      v_end_date := null;
      v_rental_days := null;
      v_unit_price := round(v_product.price);
      if v_is_token_payment then
        update public.physical_products set stock_quantity = stock_quantity - v_quantity
        where id = v_product.id and stock_quantity >= v_quantity;
        if not found then raise exception '% 庫存不足', v_product.name; end if;
      end if;
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

  if v_is_token_payment then
    update public.customers set token_balance = v_new_balance, updated_at = now() where id = v_customer_id;
    insert into public.token_transactions (customer_id, amount, transaction_type, balance_after, reason)
    values (v_customer_id, -v_total::integer, 'purchase', v_new_balance,
      '一飛通商城儲值金結帳 (訂單 ' || left(v_order_id::text, 8) || ')');
  end if;
  return v_order_id;
end;
$$;

revoke all on function public.create_physical_order_with_items(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_physical_order_with_items(jsonb, jsonb) to service_role;
