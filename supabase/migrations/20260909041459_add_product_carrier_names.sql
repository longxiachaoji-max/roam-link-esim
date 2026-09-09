alter table public.products
  add column if not exists carrier_names text;

comment on column public.products.carrier_names is
  'Per-product mobile carriers parsed from the supplier network list. Multiple carriers are separated by /.';

with source as (
  select
    id,
    upper(nullif(btrim(supplier_raw->>'code'), '')) as target_code,
    coalesce(supplier_raw->>'networks', '') as networks
  from public.products
  where supplier = 'microesim'
), entries as (
  select
    source.id,
    source.target_code,
    btrim(network_entry.entry) as entry,
    upper(btrim(split_part(network_entry.entry, ':', 1))) as entry_code
  from source
  cross join lateral regexp_split_to_table(source.networks, E'\\|') as network_entry(entry)
  where position(':' in network_entry.entry) > 0
), scoped_entries as (
  select
    *,
    bool_or(entry_code = target_code) over (partition by id) as has_target_entry
  from entries
), carrier_pieces as (
  select
    id,
    entry_code,
    btrim(regexp_replace(piece, E'\\[.*$', '')) as raw_carrier
  from scoped_entries
  cross join lateral regexp_split_to_table(
    substring(entry from position(':' in entry) + 1),
    E'\\]\\s*,\\s*'
  ) as carrier_piece(piece)
  where not has_target_entry or entry_code = target_code
), normalized as (
  select
    id,
    case
      when entry_code = 'JP' and lower(raw_carrier) in ('au', 'kddi') then 'KDDI'
      when entry_code = 'JP' and lower(raw_carrier) in ('iij', 'docomo') then 'Docomo'
      when entry_code = 'JP' and lower(raw_carrier) in ('softbank', 'sottbank') then 'SoftBank'
      when entry_code = 'KR' and lower(raw_carrier) in ('lgu', 'lgu+', 'lg u', 'lg u+') then 'LG U+'
      when entry_code = 'CN' and lower(raw_carrier) in ('cucc', 'china unicom') then '中國聯通'
      when entry_code = 'CN' and lower(raw_carrier) in ('cmcc', 'china mobile') then '中國移動'
      else raw_carrier
    end as carrier
  from carrier_pieces
  where raw_carrier <> ''
), grouped as (
  select id, string_agg(carrier, ' / ' order by carrier) as carrier_names
  from (select distinct id, carrier from normalized) unique_carriers
  group by id
)
update public.products as product
set carrier_names = grouped.carrier_names
from grouped
where product.id = grouped.id
  and nullif(btrim(product.carrier_names), '') is null;
