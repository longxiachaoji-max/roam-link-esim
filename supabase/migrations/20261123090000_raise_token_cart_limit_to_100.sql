-- 儲值金結帳一次最多 100 張（原本 20 張，客人一次買 60 張會被擋下）
-- 直接以正式環境現有的函式定義為準，只替換數量上限。
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.create_atomic_token_cart_checkout(uuid,uuid[],integer,integer,integer,uuid)'::regprocedure)
    into v_def;
  if position('array_length(p_product_ids, 1) > 20' in v_def) = 0 then
    raise notice 'limit already changed';
    return;
  end if;
  execute replace(v_def, 'array_length(p_product_ids, 1) > 20', 'array_length(p_product_ids, 1) > 100');
end
$$;
