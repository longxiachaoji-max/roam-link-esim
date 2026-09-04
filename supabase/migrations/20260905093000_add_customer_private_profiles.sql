create table if not exists public.customer_private_profiles (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  legal_name text,
  national_id text,
  birth_date date,
  residential_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_private_profiles_legal_name_check
    check (legal_name is null or char_length(legal_name) between 1 and 80),
  constraint customer_private_profiles_national_id_check
    check (national_id is null or char_length(national_id) between 4 and 30),
  constraint customer_private_profiles_birth_date_check
    check (birth_date is null or birth_date >= date '1900-01-01'),
  constraint customer_private_profiles_address_check
    check (residential_address is null or char_length(residential_address) between 5 and 300)
);

create unique index if not exists customer_private_profiles_national_id_idx
  on public.customer_private_profiles (upper(national_id))
  where national_id is not null;

insert into public.customer_private_profiles (
  customer_id, legal_name, national_id, birth_date, residential_address
)
select customer_id, legal_name, national_id, birth_date, residential_address
from public.customer_identity_verifications
where legal_name is not null
   or national_id is not null
   or birth_date is not null
   or residential_address is not null
on conflict (customer_id) do update set
  legal_name = excluded.legal_name,
  national_id = excluded.national_id,
  birth_date = excluded.birth_date,
  residential_address = excluded.residential_address,
  updated_at = now();

alter table public.customer_private_profiles enable row level security;
revoke all on table public.customer_private_profiles from public, anon, authenticated;
grant all on table public.customer_private_profiles to service_role;
