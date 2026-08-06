create table if not exists public.destination_requests (
  id uuid primary key default gen_random_uuid(),
  country text not null check (char_length(btrim(country)) between 2 and 40),
  country_key text not null check (char_length(btrim(country_key)) between 2 and 40),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (visitor_id, country_key)
);

create index if not exists destination_requests_created_idx
  on public.destination_requests (created_at desc);

alter table public.destination_requests enable row level security;

revoke all on public.destination_requests from anon, authenticated;
grant select, insert, update, delete on public.destination_requests to service_role;
