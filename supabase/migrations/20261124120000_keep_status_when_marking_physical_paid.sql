-- 確認面交收款時，不要把已出貨/已完成的訂單退回處理中
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
  v_product_category text;
  v_updated_count integer;
  v_stock_issue boolean := false;
begin
  select * into v_order from public.physical_orders where id = p_order_id for update;
  if not found then return 'NOT_FOUND'; end if;
  if v_order.total_amount <> p_paid_amount then return 'AMOUNT_MISMATCH'; end if;
  if v_order.payment_status = 'PAID' then return v_order.order_status; end if;

  for v_item in select * from public.physical_order_items where order_id = p_order_id
  loop
    if v_item.product_id is null then
      v_stock_issue := true;
      continue;
    end if;
    select category into v_product_category from public.physical_products where id = v_item.product_id;
    if v_product_category = 'rental' then continue; end if;

    update public.physical_products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id and stock_quantity >= v_item.quantity;
    get diagnostics v_updated_count = row_count;
    if v_updated_count = 0 then v_stock_issue := true; end if;
  end loop;

  update public.physical_orders
  set payment_status = 'PAID',
      order_status = case
        when v_order.order_status in ('SHIPPED', 'COMPLETED') then v_order.order_status
        when v_stock_issue then 'STOCK_ISSUE'
        else 'PROCESSING'
      end,
      reservation_expires_at = null,
      updated_at = now()
  where id = p_order_id;

  return case
    when v_order.order_status in ('SHIPPED', 'COMPLETED') then v_order.order_status
    when v_stock_issue then 'STOCK_ISSUE'
    else 'PROCESSING'
  end;
end;
$$;

revoke all on function public.mark_physical_order_paid(uuid, numeric) from public, anon, authenticated;
grant execute on function public.mark_physical_order_paid(uuid, numeric) to service_role;

-- 修復：741b4ea4 已完成後按確認收款被退回處理中
update public.physical_orders set order_status = 'COMPLETED', updated_at = now() where id::text like '741b4ea4%' and payment_method = 'CASH_PICKUP' and payment_status = 'PAID' and order_status = 'PROCESSING';
