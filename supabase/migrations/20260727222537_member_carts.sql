create table if not exists public.member_carts (
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_type text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, cart_type),
  constraint member_carts_cart_type_check check (cart_type = 'physical'),
  constraint member_carts_items_check check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) <= 20
  )
);

alter table public.member_carts enable row level security;

revoke all on public.member_carts from public, anon, authenticated;
grant select, insert, update, delete on public.member_carts to service_role;

comment on table public.member_carts is
  'Server-managed member shopping carts. Browser clients must use authenticated API routes.';
