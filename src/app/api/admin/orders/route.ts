import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fulfillMicroesimOrderItem, reconcilePendingMicroesimItems } from '@/lib/microesim-fulfillment';
import { sendMicroesimFulfillmentFailureAlert } from '@/lib/order-alerts';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET - 取得所有訂單
export async function GET() {
  try {
    try {
      await reconcilePendingMicroesimItems(supabase, { limit: 10, minAgeSeconds: 10 });
    } catch (reconcileError) {
      console.error('Admin MicroEsim reconciliation failed:', reconcileError);
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        total_amount,
        tokens_used,
        payment_method,
        payment_status,
        order_status,
        customers (
          email,
          name
        ),
        order_items (
          id,
          price,
          note,
          user_deleted_at,
          product_id,
          inventory_id,
          supplier_order_ref,
          supplier_order_id,
          supplier_status,
          supplier_last_checked_at,
          supplier_error,
          products (
            id,
            name,
            country,
            data_amount,
            validity_days,
            supplier,
            supplier_plan_id,
            supplier_plan_name,
            supplier_cost_twd,
            supplier_raw
          ),
          e_sim_inventory (
            iccid,
            smdp_address,
            activation_code,
            status,
            cost
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - 手動補上 eSIM 庫存到訂單明細
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { order_item_id, inventory_id, action } = body;

    if (!order_item_id) {
      return NextResponse.json({ error: '缺少 order_item_id' }, { status: 400 });
    }

    if (action === 'restore_deleted') {
      const { error } = await supabase
        .from('order_items')
        .update({ user_deleted_at: null })
        .eq('id', order_item_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已恢復客戶 eSIM 顯示' });
    }

    if (action === 'fulfill_microesim') {
      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          inventory_id,
          orders ( id, order_number, payment_status, customers ( email ) ),
          products (
            id,
            name,
            country,
            validity_days,
            supplier,
            supplier_plan_id,
            supplier_plan_name,
            supplier_cost_twd
          )
        `)
        .eq('id', order_item_id)
        .single();

      if (itemError || !orderItem) {
        return NextResponse.json({ error: itemError?.message || '找不到訂單明細' }, { status: 404 });
      }

      if (orderItem.inventory_id) {
        return NextResponse.json({ error: '此訂單明細已經綁定 eSIM' }, { status: 400 });
      }

      const orderRecord = (orderItem as any).orders;
      const order = Array.isArray(orderRecord) ? orderRecord[0] : orderRecord;
      const orderStatus = order?.payment_status;
      if (orderStatus !== 'PAID') {
        return NextResponse.json({ error: '訂單尚未付款，不能自動配發 MicroEsim' }, { status: 400 });
      }

      const productRecord = (orderItem as any).products;
      const product = Array.isArray(productRecord) ? productRecord[0] : productRecord;
      if (!orderItem.product_id || !product?.supplier_plan_id) {
        return NextResponse.json({ error: '這筆商品沒有連結 MicroEsim 方案 ID' }, { status: 400 });
      }

      let inventory;
      try {
        inventory = await fulfillMicroesimOrderItem(supabase, orderItem.id, orderItem.product_id, product);
      } catch (error) {
        const customerRecord = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
        await sendMicroesimFulfillmentFailureAlert(supabase, {
          source: '後台手動自動配發',
          orderId: orderItem.order_id,
          orderItemId: orderItem.id,
          customerEmail: customerRecord?.email,
          productName: product.name,
          country: product.country,
          validityDays: product.validity_days,
          supplierPlanId: product.supplier_plan_id,
          error
        });
        throw error;
      }
      if (!inventory) {
        return NextResponse.json({
          success: true,
          pending: true,
          message: 'MicroEsim 訂單已送出，正在等待 QR Code 生成'
        });
      }

      const { data: remainingItems, error: remainingError } = await supabase
        .from('order_items')
        .select('id, inventory_id')
        .eq('order_id', orderItem.order_id);

      if (!remainingError && remainingItems?.every(item => item.inventory_id)) {
        await supabase
          .from('orders')
          .update({ order_status: 'COMPLETED', updated_at: new Date().toISOString() })
          .eq('id', orderItem.order_id);
      }

      return NextResponse.json({ success: true, inventory });
    }

    if (!inventory_id) {
      return NextResponse.json({ error: '缺少 inventory_id' }, { status: 400 });
    }

    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, inventory_id')
      .eq('id', order_item_id)
      .single();

    if (itemError || !orderItem) {
      return NextResponse.json({ error: itemError?.message || '找不到訂單明細' }, { status: 404 });
    }

    if (orderItem.inventory_id) {
      return NextResponse.json({ error: '此訂單明細已經綁定 eSIM' }, { status: 400 });
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from('e_sim_inventory')
      .select('id, product_id, status')
      .eq('id', inventory_id)
      .single();

    if (inventoryError || !inventory) {
      return NextResponse.json({ error: inventoryError?.message || '找不到 eSIM 庫存' }, { status: 404 });
    }

    if (inventory.status !== 'AVAILABLE') {
      return NextResponse.json({ error: '這筆 eSIM 庫存不是可使用狀態' }, { status: 400 });
    }

    if (inventory.product_id !== orderItem.product_id) {
      return NextResponse.json({ error: '選擇的 eSIM 商品不符合訂單商品' }, { status: 400 });
    }

    const { error: updateInventoryError } = await supabase
      .from('e_sim_inventory')
      .update({
        status: 'SOLD',
        sold_at: new Date().toISOString()
      })
      .eq('id', inventory_id)
      .eq('status', 'AVAILABLE');

    if (updateInventoryError) {
      return NextResponse.json({ error: updateInventoryError.message }, { status: 500 });
    }

    const { error: updateItemError } = await supabase
      .from('order_items')
      .update({ inventory_id })
      .eq('id', order_item_id);

    if (updateItemError) {
      return NextResponse.json({ error: updateItemError.message }, { status: 500 });
    }

    const { data: remainingItems, error: remainingError } = await supabase
      .from('order_items')
      .select('id, inventory_id')
      .eq('order_id', orderItem.order_id);

    if (!remainingError && remainingItems?.every(item => item.inventory_id)) {
      await supabase
        .from('orders')
        .update({ order_status: 'COMPLETED' })
        .eq('id', orderItem.order_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - 刪除訂單，並將已綁定的 eSIM 庫存退回可用
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: '缺少 order_id' }, { status: 400 });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('inventory_id')
      .eq('order_id', order_id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const inventoryIds = (orderItems || [])
      .map(item => item.inventory_id)
      .filter(Boolean);

    if (inventoryIds.length > 0) {
      const { error: inventoryError } = await supabase
        .from('e_sim_inventory')
        .update({
          status: 'AVAILABLE',
          sold_at: null
        })
        .in('id', inventoryIds);

      if (inventoryError) {
        return NextResponse.json({ error: inventoryError.message }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', order_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
