create table if not exists public.dealer_referral_links (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  referral_code_id uuid not null references public.dealer_referral_codes(id) on delete cascade,
  name text not null,
  slug text not null unique,
  click_count bigint not null default 0,
  last_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dealer_referral_links_name_check check (
    length(trim(name)) between 1 and 80
  ),
  constraint dealer_referral_links_slug_check check (
    slug ~ '^[a-z0-9]{16}$'
  ),
  constraint dealer_referral_links_click_count_check check (click_count >= 0)
);

create index if not exists idx_dealer_referral_links_dealer_created
  on public.dealer_referral_links (dealer_id, created_at desc);

create index if not exists idx_dealer_referral_links_code
  on public.dealer_referral_links (referral_code_id);

alter table public.dealer_referral_links enable row level security;
revoke all on public.dealer_referral_links from public, anon, authenticated;
grant select, insert, update, delete on public.dealer_referral_links to service_role;

drop trigger if exists update_dealer_referral_links_modtime
  on public.dealer_referral_links;
create trigger update_dealer_referral_links_modtime
before update on public.dealer_referral_links
for each row execute procedure public.update_modified_column();

create or replace function public.record_dealer_referral_link_click(p_slug text)
returns table(referral_code text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update public.dealer_referral_links as link
  set click_count = link.click_count + 1,
      last_clicked_at = now()
  from public.dealer_referral_codes as code,
       public.dealers as dealer
  where link.slug = lower(trim(p_slug))
    and code.id = link.referral_code_id
    and code.dealer_id = link.dealer_id
    and code.is_active = true
    and dealer.id = link.dealer_id
    and dealer.status = 'approved'
    and dealer.sales_mode = 'referral'
  returning code.code::text;
end;
$$;

revoke all on function public.record_dealer_referral_link_click(text)
  from public, anon, authenticated;
grant execute on function public.record_dealer_referral_link_click(text)
  to service_role;
