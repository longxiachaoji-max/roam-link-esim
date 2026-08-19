alter table public.promo_codes
  add column if not exists name text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(10, 2) not null default 0,
  add column if not exists max_discount numeric(10, 2),
  add column if not exists min_order_amount numeric(10, 2) not null default 0,
  add column if not exists starts_at timestamp with time zone,
  add column if not exists is_active boolean not null default true,
  add column if not exists audience_type text not null default 'public',
  add column if not exists assigned_email text,
  add column if not exists company_name text,
  add column if not exists allowed_email_domain text,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.orders
  add column if not exists original_total_amount numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists promo_code_snapshot text;

alter table public.promo_redemptions
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists redemption_type text not null default 'balance_reward';

create unique index if not exists idx_promo_redemptions_order_id
  on public.promo_redemptions (order_id)
  where order_id is not null;

create index if not exists idx_promo_redemptions_customer_code
  on public.promo_redemptions (customer_id, promo_code_id);

create index if not exists idx_promo_codes_checkout_lookup
  on public.promo_codes (code, is_active, starts_at, expires_at)
  where reward_type = 'discount';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_reward_type_check') then
    alter table public.promo_codes
      add constraint promo_codes_reward_type_check
      check (reward_type in ('tokens', 'discount')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_discount_type_check') then
    alter table public.promo_codes
      add constraint promo_codes_discount_type_check
      check (discount_type is null or discount_type in ('percent', 'fixed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_audience_type_check') then
    alter table public.promo_codes
      add constraint promo_codes_audience_type_check
      check (audience_type in ('public', 'personal', 'company')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promo_codes_amounts_check') then
    alter table public.promo_codes
      add constraint promo_codes_amounts_check
      check (
        discount_value >= 0
        and min_order_amount >= 0
        and (max_discount is null or max_discount > 0)
        and coalesce(max_uses, 1) > 0
        and coalesce(max_uses_per_user, 1) > 0
      ) not valid;
  end if;
end
$$;

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

create or replace function public.record_checkout_promo_redemption(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_redemption_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select id, customer_id, promo_code_id, discount_amount, payment_status
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.payment_status <> 'PAID' or v_order.promo_code_id is null then
    return false;
  end if;

  insert into public.promo_redemptions (
    customer_id, promo_code_id, order_id, discount_amount, redemption_type
  ) values (
    v_order.customer_id, v_order.promo_code_id, v_order.id,
    coalesce(v_order.discount_amount, 0), 'checkout_discount'
  )
  on conflict (order_id) where order_id is not null do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    return false;
  end if;

  update public.promo_codes
  set used_count = coalesce(used_count, 0) + 1,
      updated_at = now()
  where id = v_order.promo_code_id;

  return true;
end;
$$;

revoke all on function public.record_checkout_promo_redemption(uuid)
  from public, anon, authenticated;
grant execute on function public.record_checkout_promo_redemption(uuid)
  to service_role;
