alter table public.dealers
  add column if not exists pricing_mode text not null default 'fixed_markup',
  add column if not exists pricing_value numeric(10, 2) not null default 10;

alter table public.dealers
  drop constraint if exists dealers_pricing_mode_check,
  drop constraint if exists dealers_pricing_value_check;

alter table public.dealers
  add constraint dealers_pricing_mode_check
    check (pricing_mode in ('percentage_markup', 'fixed_markup')),
  add constraint dealers_pricing_value_check
    check (
      (pricing_mode = 'percentage_markup' and pricing_value between 0 and 500)
      or (pricing_mode = 'fixed_markup' and pricing_value between 0 and 100000)
    );

alter table public.dealer_orders
  add column if not exists pricing_mode text,
  add column if not exists pricing_value numeric(10, 2);

alter table public.dealer_orders
  drop constraint if exists dealer_orders_pricing_snapshot_check;

alter table public.dealer_orders
  add constraint dealer_orders_pricing_snapshot_check
    check (
      (pricing_mode is null and pricing_value is null)
      or (
        pricing_mode in ('percentage_markup', 'fixed_markup')
        and pricing_value >= 0
      )
    );

create or replace function public.create_atomic_dealer_order(
  p_dealer_id uuid,
  p_customer_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_product_ids uuid[]
)
returns table (
  dealer_order_id uuid,
  order_id uuid,
  order_number text,
  order_item_ids uuid[],
  new_balance integer,
  dealer_total integer,
  retail_total integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dealer public.dealers%rowtype;
  v_product_count integer;
  v_all_active boolean;
  v_retail_total integer;
  v_dealer_total integer;
  v_new_balance integer;
  v_order_id uuid;
  v_order_number text;
  v_dealer_order_id uuid;
  v_item_ids uuid[] := array[]::uuid[];
  v_requested record;
  v_order_item_id uuid;
  v_retail_price integer;
  v_dealer_price integer;
begin
  if coalesce(array_length(p_product_ids, 1), 0) < 1
     or array_length(p_product_ids, 1) > 20 then
    raise exception 'INVALID_PRODUCTS';
  end if;

  select * into v_dealer
  from public.dealers
  where id = p_dealer_id
  for update;

  if not found then raise exception 'DEALER_NOT_FOUND'; end if;
  if v_dealer.status <> 'approved' then raise exception 'DEALER_NOT_APPROVED'; end if;

  select count(*),
    bool_and(coalesce(product.is_active, false) and coalesce(product.supplier_cost_twd, 0) > 0),
    coalesce(sum(round(product.price)::integer), 0),
    coalesce(sum(
      greatest(1, round(
        case
          when v_dealer.pricing_mode = 'percentage_markup'
            then product.supplier_cost_twd * (1 + v_dealer.pricing_value / 100)
          else product.supplier_cost_twd + v_dealer.pricing_value
        end
      )::integer)
    ), 0)
  into v_product_count, v_all_active, v_retail_total, v_dealer_total
  from unnest(p_product_ids) as requested(product_id)
  join public.products product on product.id = requested.product_id;

  if v_product_count <> array_length(p_product_ids, 1) or not coalesce(v_all_active, false) then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if v_dealer.balance < v_dealer_total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  v_new_balance := v_dealer.balance - v_dealer_total;

  insert into public.orders (
    customer_id, total_amount, original_total_amount, discount_amount,
    tokens_used, payment_method, payment_status, order_status
  ) values (
    p_customer_id, 0, v_retail_total, 0,
    0, 'DEALER_BALANCE', 'PAID', 'PENDING'
  ) returning id, public.orders.order_number into v_order_id, v_order_number;

  insert into public.dealer_orders (
    dealer_id, fulfillment_order_id, customer_email, customer_name,
    retail_total, dealer_total, price_rate_percent, pricing_mode, pricing_value
  ) values (
    p_dealer_id, v_order_id, lower(trim(p_customer_email)), nullif(trim(p_customer_name), ''),
    v_retail_total, v_dealer_total, v_dealer.price_rate_percent,
    v_dealer.pricing_mode, v_dealer.pricing_value
  ) returning id into v_dealer_order_id;

  for v_requested in
    select product.id, product.price, product.supplier_cost_twd
    from unnest(p_product_ids) with ordinality as requested(product_id, position)
    join public.products product on product.id = requested.product_id
    order by requested.position
  loop
    v_retail_price := round(v_requested.price)::integer;
    v_dealer_price := greatest(1, round(
      case
        when v_dealer.pricing_mode = 'percentage_markup'
          then v_requested.supplier_cost_twd * (1 + v_dealer.pricing_value / 100)
        else v_requested.supplier_cost_twd + v_dealer.pricing_value
      end
    )::integer);

    insert into public.order_items (order_id, product_id, inventory_id, price)
    values (v_order_id, v_requested.id, null, v_retail_price)
    returning id into v_order_item_id;
    v_item_ids := array_append(v_item_ids, v_order_item_id);

    insert into public.dealer_order_items (
      dealer_order_id, order_item_id, product_id, retail_price, dealer_price
    ) values (
      v_dealer_order_id, v_order_item_id, v_requested.id, v_retail_price, v_dealer_price
    );
  end loop;

  update public.dealers set balance = v_new_balance where id = p_dealer_id;
  insert into public.dealer_balance_transactions (
    dealer_id, amount, balance_after, transaction_type, reason, dealer_order_id
  ) values (
    p_dealer_id, -v_dealer_total, v_new_balance, 'purchase',
    '代客購買 eSIM（訂單 ' || v_order_number || '）', v_dealer_order_id
  );

  return query select v_dealer_order_id, v_order_id, v_order_number,
    v_item_ids, v_new_balance, v_dealer_total, v_retail_total;
end;
$$;

revoke all on function public.create_atomic_dealer_order(uuid, uuid, text, text, uuid[])
from public, anon, authenticated;
grant execute on function public.create_atomic_dealer_order(uuid, uuid, text, text, uuid[])
to service_role;
