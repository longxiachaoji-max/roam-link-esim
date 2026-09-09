alter table public.products
  add column if not exists network_type text;

comment on column public.products.network_type is
  'Per-product supported mobile network generations, for example 4G, 5G, or 4G / 5G.';

update public.products
set network_type = case
  when concat_ws(' ', supplier_raw->>'networks', name, data_amount, description) ~* '(^|[^0-9])5G([^0-9]|$)'
   and concat_ws(' ', supplier_raw->>'networks', name, data_amount, description) ~* '(^|[^0-9])(4G|LTE)([^0-9]|$)'
    then '4G / 5G'
  when concat_ws(' ', supplier_raw->>'networks', name, data_amount, description) ~* '(^|[^0-9])5G([^0-9]|$)'
    then '5G'
  when concat_ws(' ', supplier_raw->>'networks', name, data_amount, description) ~* '(^|[^0-9])(4G|LTE)([^0-9]|$)'
    then '4G'
  when concat_ws(' ', supplier_raw->>'networks', name, data_amount, description) ~* '(^|[^0-9])3G([^0-9]|$)'
    then '3G'
  else network_type
end
where nullif(btrim(network_type), '') is null;

alter table public.products
  drop constraint if exists products_network_type_length_check;

alter table public.products
  add constraint products_network_type_length_check
  check (network_type is null or char_length(network_type) <= 40);
