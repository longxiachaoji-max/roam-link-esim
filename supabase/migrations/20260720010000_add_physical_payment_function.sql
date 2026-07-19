create or replace function public.mark_physical_order_paid(
  p_order_id uuid,
  p_paid_amount numeric
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.physical_orders%rowtype;
  v_item public.physical_order_items%rowtype;
  v_updated_count integer;
  v_stock_issue boolean := false;
begin
  select * into v_order
  from public.physical_orders
  where id = p_order_id
  for update;

  if not found then
    return 'NOT_FOUND';
  end if;

  if v_order.total_amount <> p_paid_amount then
    return 'AMOUNT_MISMATCH';
  end if;

  if v_order.payment_status = 'PAID' then
    return v_order.order_status;
  end if;

  for v_item in
    select * from public.physical_order_items where order_id = p_order_id
  loop
    if v_item.product_id is null then
      v_stock_issue := true;
      continue;
    end if;

    update public.physical_products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id
      and stock_quantity >= v_item.quantity;
    get diagnostics v_updated_count = row_count;

    if v_updated_count = 0 then
      v_stock_issue := true;
    end if;
  end loop;

  update public.physical_orders
  set payment_status = 'PAID',
      order_status = case when v_stock_issue then 'STOCK_ISSUE' else 'PROCESSING' end,
      updated_at = now()
  where id = p_order_id;

  return case when v_stock_issue then 'STOCK_ISSUE' else 'PROCESSING' end;
end;
$$;

revoke all on function public.mark_physical_order_paid(uuid, numeric) from public, anon, authenticated;
grant execute on function public.mark_physical_order_paid(uuid, numeric) to service_role;
