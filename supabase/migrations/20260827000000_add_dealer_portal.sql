create table if not exists public.dealers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  store_name text not null,
  contact_name text,
  phone text,
  tax_id text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  price_rate_percent numeric(5, 2) not null default 60
    check (price_rate_percent > 0 and price_rate_percent <= 100),
  balance integer not null default 0 check (balance >= 0),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealer_orders (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  fulfillment_order_id uuid not null unique references public.orders(id) on delete restrict,
  customer_email text not null,
  customer_name text,
  retail_total integer not null check (retail_total >= 0),
  dealer_total integer not null check (dealer_total > 0),
  price_rate_percent numeric(5, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.dealer_order_items (
  id uuid primary key default uuid_generate_v4(),
  dealer_order_id uuid not null references public.dealer_orders(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  retail_price integer not null check (retail_price >= 0),
  dealer_price integer not null check (dealer_price > 0),
  delivery_email_status text not null default 'pending'
    check (delivery_email_status in ('pending', 'sending', 'sent', 'failed')),
  delivery_email_sent_at timestamptz,
  delivery_email_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.dealer_topup_requests (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  amount integer not null check (amount > 0),
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.dealer_balance_transactions (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  cash_received_amount integer not null default 0 check (cash_received_amount >= 0),
  transaction_type text not null
    check (transaction_type in ('cash_topup', 'purchase', 'adjustment', 'refund')),
  reason text not null,
  dealer_order_id uuid references public.dealer_orders(id) on delete restrict,
  topup_request_id uuid unique references public.dealer_topup_requests(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dealers_status_created
  on public.dealers (status, created_at desc);
create index if not exists idx_dealer_orders_dealer_created
  on public.dealer_orders (dealer_id, created_at desc);
create index if not exists idx_dealer_order_items_dealer_order
  on public.dealer_order_items (dealer_order_id);
create index if not exists idx_dealer_topup_requests_status_created
  on public.dealer_topup_requests (status, created_at desc);
create unique index if not exists idx_dealer_one_pending_topup
  on public.dealer_topup_requests (dealer_id)
  where status = 'pending';
create index if not exists idx_dealer_balance_transactions_dealer_created
  on public.dealer_balance_transactions (dealer_id, created_at desc);

drop trigger if exists update_dealers_modtime on public.dealers;
create trigger update_dealers_modtime
before update on public.dealers
for each row execute procedure public.update_modified_column();

alter table public.dealers enable row level security;
alter table public.dealer_orders enable row level security;
alter table public.dealer_order_items enable row level security;
alter table public.dealer_topup_requests enable row level security;
alter table public.dealer_balance_transactions enable row level security;

revoke all on public.dealers, public.dealer_orders, public.dealer_order_items,
  public.dealer_topup_requests, public.dealer_balance_transactions
from public, anon, authenticated;

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
security definer
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
  if (select auth.role()) <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

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

  select count(*), bool_and(coalesce(product.is_active, false)),
    coalesce(sum(round(product.price)::integer), 0),
    coalesce(sum(greatest(1, round(product.price * v_dealer.price_rate_percent / 100)::integer)), 0)
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
    retail_total, dealer_total, price_rate_percent
  ) values (
    p_dealer_id, v_order_id, lower(trim(p_customer_email)), nullif(trim(p_customer_name), ''),
    v_retail_total, v_dealer_total, v_dealer.price_rate_percent
  ) returning id into v_dealer_order_id;

  for v_requested in
    select product.id, product.price
    from unnest(p_product_ids) with ordinality as requested(product_id, position)
    join public.products product on product.id = requested.product_id
    order by requested.position
  loop
    v_retail_price := round(v_requested.price)::integer;
    v_dealer_price := greatest(1, round(v_requested.price * v_dealer.price_rate_percent / 100)::integer);
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

create or replace function public.adjust_dealer_balance(
  p_dealer_id uuid,
  p_amount integer,
  p_cash_received_amount integer,
  p_reason text,
  p_admin_user_id uuid
)
returns table (new_balance integer, transaction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_amount = 0 or p_cash_received_amount < 0 or nullif(trim(p_reason), '') is null then
    raise exception 'INVALID_ADJUSTMENT';
  end if;

  select balance into v_balance from public.dealers where id = p_dealer_id for update;
  if not found then raise exception 'DEALER_NOT_FOUND'; end if;
  v_new_balance := v_balance + p_amount;
  if v_new_balance < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.dealers set balance = v_new_balance where id = p_dealer_id;
  insert into public.dealer_balance_transactions (
    dealer_id, amount, balance_after, cash_received_amount,
    transaction_type, reason, created_by
  ) values (
    p_dealer_id, p_amount, v_new_balance, p_cash_received_amount,
    case when p_amount > 0 and p_cash_received_amount > 0 then 'cash_topup' else 'adjustment' end,
    trim(p_reason), p_admin_user_id
  ) returning id into v_transaction_id;

  return query select v_new_balance, v_transaction_id;
end;
$$;

create or replace function public.approve_dealer_topup_request(
  p_request_id uuid,
  p_admin_user_id uuid
)
returns table (new_balance integer, transaction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.dealer_topup_requests%rowtype;
  v_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;

  select * into v_request
  from public.dealer_topup_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;

  select balance into v_balance
  from public.dealers
  where id = v_request.dealer_id
  for update;
  if not found then raise exception 'DEALER_NOT_FOUND'; end if;

  v_new_balance := v_balance + v_request.amount;
  update public.dealers set balance = v_new_balance where id = v_request.dealer_id;
  update public.dealer_topup_requests
  set status = 'approved', reviewed_by = p_admin_user_id, reviewed_at = now()
  where id = p_request_id;

  insert into public.dealer_balance_transactions (
    dealer_id, amount, balance_after, cash_received_amount,
    transaction_type, reason, topup_request_id, created_by
  ) values (
    v_request.dealer_id, v_request.amount, v_new_balance, v_request.amount,
    'cash_topup', '現金加值申請核准', p_request_id, p_admin_user_id
  ) returning id into v_transaction_id;

  return query select v_new_balance, v_transaction_id;
end;
$$;

revoke all on function public.create_atomic_dealer_order(uuid, uuid, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.adjust_dealer_balance(uuid, integer, integer, text, uuid)
  from public, anon, authenticated;
revoke all on function public.approve_dealer_topup_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_atomic_dealer_order(uuid, uuid, text, text, uuid[])
  to service_role;
grant execute on function public.adjust_dealer_balance(uuid, integer, integer, text, uuid)
  to service_role;
grant execute on function public.approve_dealer_topup_request(uuid, uuid)
  to service_role;
