update public.products
set
  name = regexp_replace(name, '^日本[[:space:]]+', '日本 本地網路Docomo '),
  carrier_names = 'Docomo'
where supplier = 'microesim'
  and supplier_plan_name ~* 'japan.*iij'
  and name !~ '本地網路';

update public.products
set carrier_names = 'Docomo'
where supplier = 'microesim'
  and supplier_plan_name ~* 'japan.*iij'
  and carrier_names is distinct from 'Docomo';
