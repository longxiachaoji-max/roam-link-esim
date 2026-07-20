create or replace function public.create_atomic_token_checkout(
  p_customer_id uuid,
  p_product_id uuid,
  p_payable_tokens integer
)
returns table (
  order_id uuid,
  order_number text,
  order_item_id uuid,
  new_balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_price numeric;
  v_is_active boolean;
  v_order_id uuid;
  v_order_number text;
  v_order_item_id uuid;
  v_new_balance integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if p_payable_tokens <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select price, coalesce(is_active, false)
  into v_price, v_is_active
  from public.products
  where id = p_product_id;

  if not found or not v_is_active then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if p_payable_tokens > round(v_price)::integer then
    raise exception 'INVALID_AMOUNT';
  end if;

  select token_balance
  into v_balance
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;
  if coalesce(v_balance, 0) < p_payable_tokens then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  v_new_balance := v_balance - p_payable_tokens;

  insert into public.orders (
    customer_id,
    total_amount,
    tokens_used,
    payment_method,
    payment_status,
    order_status
  ) values (
    p_customer_id,
    0,
    p_payable_tokens,
    'TOKENS',
    'PAID',
    'PENDING'
  )
  returning id, public.orders.order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, product_id, inventory_id, price)
  values (v_order_id, p_product_id, null, v_price)
  returning id into v_order_item_id;

  update public.customers
  set token_balance = v_new_balance,
      updated_at = now()
  where id = p_customer_id;

  insert into public.token_transactions (
    customer_id,
    amount,
    transaction_type,
    balance_after,
    reason
  ) values (
    p_customer_id,
    -p_payable_tokens,
    'purchase',
    v_new_balance,
    '購買 eSIM (訂單 ' || v_order_number || ')'
  );

  return query select v_order_id, v_order_number, v_order_item_id, v_new_balance;
end;
$$;

revoke all on function public.create_atomic_token_checkout(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.create_atomic_token_checkout(uuid, uuid, integer) to service_role;
