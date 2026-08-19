create or replace function public.create_atomic_token_cart_checkout(
  p_customer_id uuid,
  p_product_ids uuid[],
  p_payable_tokens integer,
  p_original_total integer,
  p_discount_amount integer default 0,
  p_promo_code_id uuid default null
)
returns table (
  order_id uuid,
  order_number text,
  order_item_ids uuid[],
  new_balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_customer_email text;
  v_product_count integer;
  v_expected_total integer;
  v_all_active boolean;
  v_order_id uuid;
  v_order_number text;
  v_order_item_ids uuid[];
  v_new_balance integer;
  v_promo record;
  v_promo_code text;
  v_user_uses integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if coalesce(array_length(p_product_ids, 1), 0) < 1
     or array_length(p_product_ids, 1) > 20 then
    raise exception 'INVALID_PRODUCTS';
  end if;

  select count(*), coalesce(sum(round(product.price)::integer), 0), bool_and(coalesce(product.is_active, false))
  into v_product_count, v_expected_total, v_all_active
  from unnest(p_product_ids) as requested(product_id)
  join public.products product on product.id = requested.product_id;

  if v_product_count <> array_length(p_product_ids, 1) or not coalesce(v_all_active, false) then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if p_original_total <> v_expected_total
     or p_discount_amount < 0
     or p_discount_amount >= v_expected_total
     or p_payable_tokens <> v_expected_total - p_discount_amount
     or p_payable_tokens <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select token_balance, lower(email)
  into v_balance, v_customer_email
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;
  if coalesce(v_balance, 0) < p_payable_tokens then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  if p_promo_code_id is not null then
    select * into v_promo
    from public.promo_codes
    where id = p_promo_code_id
    for update;

    if not found
       or v_promo.reward_type <> 'discount'
       or not coalesce(v_promo.is_active, false)
       or (v_promo.starts_at is not null and v_promo.starts_at > now())
       or (v_promo.expires_at is not null and v_promo.expires_at < now())
       or coalesce(v_promo.used_count, 0) >= coalesce(v_promo.max_uses, 1) then
      raise exception 'PROMO_NOT_AVAILABLE';
    end if;
    if coalesce(v_promo.min_order_amount, 0) > v_expected_total then
      raise exception 'PROMO_MINIMUM_NOT_MET';
    end if;
    if v_promo.audience_type = 'personal'
       and lower(coalesce(v_promo.assigned_email, '')) <> v_customer_email then
      raise exception 'PROMO_NOT_ELIGIBLE';
    end if;
    if v_promo.audience_type = 'company'
       and nullif(trim(leading '@' from lower(coalesce(v_promo.allowed_email_domain, ''))), '') is not null
       and split_part(v_customer_email, '@', 2) <> trim(leading '@' from lower(v_promo.allowed_email_domain)) then
      raise exception 'PROMO_NOT_ELIGIBLE';
    end if;

    select count(*) into v_user_uses
    from public.promo_redemptions
    where customer_id = p_customer_id and promo_code_id = p_promo_code_id;
    if v_user_uses >= coalesce(v_promo.max_uses_per_user, 1) then
      raise exception 'PROMO_USER_LIMIT_REACHED';
    end if;
    v_promo_code := v_promo.code;
  end if;

  v_new_balance := v_balance - p_payable_tokens;

  insert into public.orders (
    customer_id, total_amount, original_total_amount, discount_amount,
    promo_code_id, promo_code_snapshot, tokens_used,
    payment_method, payment_status, order_status
  ) values (
    p_customer_id, 0, v_expected_total, p_discount_amount,
    p_promo_code_id, v_promo_code,
    p_payable_tokens, 'TOKENS', 'PAID', 'PENDING'
  )
  returning id, public.orders.order_number into v_order_id, v_order_number;

  with inserted as (
    insert into public.order_items (order_id, product_id, inventory_id, price)
    select v_order_id, product.id, null, product.price
    from unnest(p_product_ids) with ordinality as requested(product_id, position)
    join public.products product on product.id = requested.product_id
    order by requested.position
    returning id
  )
  select array_agg(id) into v_order_item_ids from inserted;

  update public.customers
  set token_balance = v_new_balance,
      updated_at = now()
  where id = p_customer_id;

  insert into public.token_transactions (
    customer_id, amount, transaction_type, balance_after, reason
  ) values (
    p_customer_id, -p_payable_tokens, 'purchase', v_new_balance,
    '購買 eSIM (訂單 ' || v_order_number || ')'
  );

  if p_promo_code_id is not null then
    insert into public.promo_redemptions (
      customer_id, promo_code_id, order_id, discount_amount, redemption_type
    ) values (
      p_customer_id, p_promo_code_id, v_order_id, p_discount_amount, 'checkout_discount'
    );
    update public.promo_codes
    set used_count = coalesce(used_count, 0) + 1,
        updated_at = now()
    where id = p_promo_code_id;
  end if;

  return query select v_order_id, v_order_number, v_order_item_ids, v_new_balance;
end;
$$;

revoke all on function public.create_atomic_token_cart_checkout(uuid, uuid[], integer, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.create_atomic_token_cart_checkout(uuid, uuid[], integer, integer, integer, uuid)
  to service_role;
