alter table public.customer_identity_verifications
  add column if not exists legal_name text,
  add column if not exists national_id text,
  add column if not exists birth_date date,
  add column if not exists residential_address text;

create unique index if not exists customer_identity_verifications_national_id_idx
  on public.customer_identity_verifications (upper(national_id))
  where national_id is not null;

alter table public.customer_identity_verifications
  drop constraint if exists customer_identity_verifications_legal_name_check,
  drop constraint if exists customer_identity_verifications_national_id_check,
  drop constraint if exists customer_identity_verifications_birth_date_check,
  drop constraint if exists customer_identity_verifications_address_check;

alter table public.customer_identity_verifications
  add constraint customer_identity_verifications_legal_name_check
    check (legal_name is null or char_length(legal_name) between 1 and 80),
  add constraint customer_identity_verifications_national_id_check
    check (national_id is null or char_length(national_id) between 4 and 30),
  add constraint customer_identity_verifications_birth_date_check
    check (birth_date is null or birth_date >= date '1900-01-01'),
  add constraint customer_identity_verifications_address_check
    check (residential_address is null or char_length(residential_address) between 5 and 300);
