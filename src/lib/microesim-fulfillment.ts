import {
  createMicroesimInventoryFromDetail,
  createMicroesimCallbackToken,
  fetchMicroesimTopupDetail,
  getMicroesimInstallationDeadline,
  getMicroesimProductPlanId,
  subscribeMicroesimPlan,
  type MicroesimProductLink,
  type MicroesimTopupDetail
} from '@/lib/microesim';
import { buildMicroesimOrderReference } from '@/lib/order-numbers';
import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseLike = SupabaseClient;

interface FulfillmentState {
  id: string;
  order_id: string;
  inventory_id: string | null;
  supplier_order_ref: string | null;
  supplier_order_id: string | null;
  supplier_status: string | null;
  supplier_last_checked_at: string | null;
  orders: { order_number?: string | null; created_at?: string | null } | Array<{ order_number?: string | null; created_at?: string | null }> | null;
}

interface PendingFulfillmentItem {
  id: string;
  product_id: string | null;
  inventory_id: string | null;
  supplier_order_id: string | null;
  supplier_last_checked_at: string | null;
  products: MicroesimFulfillmentProduct | MicroesimFulfillmentProduct[] | null;
}

export interface MicroesimFulfillmentProduct extends MicroesimProductLink {
  id?: string | null;
  supplier_cost_twd?: number | string | null;
}

function getOrderNumber(state: FulfillmentState) {
  const order = Array.isArray(state.orders) ? state.orders[0] : state.orders;
  return String(order?.order_number || '').trim();
}

async function updateSupplierState(supabase: SupabaseLike, orderItemId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('order_items').update(values).eq('id', orderItemId);
  if (error) throw error;
}

async function completeOrderWhenReady(supabase: SupabaseLike, orderId: string) {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('id, inventory_id')
    .eq('order_id', orderId);

  if (!error && items?.length && items.every((item: { inventory_id: string | null }) => item.inventory_id)) {
    await supabase
      .from('orders')
      .update({ order_status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }
}

async function saveInventory(
  supabase: SupabaseLike,
  state: FulfillmentState,
  productId: string,
  cost: number,
  detail: MicroesimTopupDetail,
  product: MicroesimFulfillmentProduct | null | undefined
) {
  const esim = createMicroesimInventoryFromDetail(detail, cost);
  const checkedAt = new Date().toISOString();

  if (!esim) {
    await updateSupplierState(supabase, state.id, {
      supplier_status: 'PROCESSING',
      supplier_last_checked_at: checkedAt,
      supplier_error: null
    });
    return null;
  }

  const order = Array.isArray(state.orders) ? state.orders[0] : state.orders;
  const installationDeadline = getMicroesimInstallationDeadline(product, detail.create_time, order?.created_at);
  const inventoryPayload = {
    product_id: productId,
    iccid: esim.iccid,
    smdp_address: esim.smdp_address,
    activation_code: esim.activation_code,
    ios_install_url: esim.ios_install_url,
    android_install_url: esim.android_install_url,
    status: 'SOLD',
    sold_at: checkedAt,
    expiry_date: installationDeadline,
    cost: esim.cost,
    microesim_topup_id: esim.topup_id
  };

  let { data: inventory, error: inventoryError } = await supabase
    .from('e_sim_inventory')
    .insert(inventoryPayload)
    .select('*')
    .single();

  if (inventoryError && esim.iccid && /duplicate|unique|iccid/i.test(inventoryError.message || '')) {
    const existingResult = await supabase
      .from('e_sim_inventory')
      .select('*')
      .eq('microesim_topup_id', esim.topup_id)
      .maybeSingle();
    if (existingResult.data) {
      inventory = existingResult.data;
      inventoryError = null;
    } else {
      const retryResult = await supabase
        .from('e_sim_inventory')
        .insert({ ...inventoryPayload, iccid: null })
        .select('*')
        .single();
      inventory = retryResult.data;
      inventoryError = retryResult.error;
    }
  }

  if (inventoryError || !inventory) {
    throw inventoryError || new Error('新增 MicroEsim 庫存失敗');
  }

  const { data: updatedItems, error: itemUpdateError } = await supabase
    .from('order_items')
    .update({
      inventory_id: inventory.id,
      supplier_status: 'COMPLETED',
      supplier_last_checked_at: checkedAt,
      supplier_error: null
    })
    .eq('id', state.id)
    .is('inventory_id', null)
    .select('id');

  if (itemUpdateError || !updatedItems?.length) {
    const { data: currentItem } = await supabase
      .from('order_items')
      .select('inventory_id')
      .eq('id', state.id)
      .single();
    if (currentItem?.inventory_id !== inventory.id) {
      await supabase.from('e_sim_inventory').delete().eq('id', inventory.id);
    }
    if (itemUpdateError) throw itemUpdateError;
    return null;
  }

  await completeOrderWhenReady(supabase, state.order_id);
  return inventory;
}

export async function fulfillMicroesimOrderItem(
  supabase: SupabaseLike,
  orderItemId: string,
  productId: string,
  product: MicroesimFulfillmentProduct | null | undefined
) {
  const planId = getMicroesimProductPlanId(product);
  if (!planId) return null;

  const { data, error: stateError } = await supabase
    .from('order_items')
    .select(`
      id,
      order_id,
      inventory_id,
      supplier_order_ref,
      supplier_order_id,
      supplier_status,
      supplier_last_checked_at,
      orders ( order_number, created_at )
    `)
    .eq('id', orderItemId)
    .single();
  if (stateError || !data) throw stateError || new Error('找不到訂單明細');

  const state = data as FulfillmentState;
  if (state.inventory_id) return null;

  const costValue = Number(product?.supplier_cost_twd || 0);
  const cost = Number.isFinite(costValue) ? costValue : 0;
  let topupId = String(state.supplier_order_id || '').trim();

  if (!topupId) {
    if (state.supplier_status === 'SUBMITTING') return null;

    const orderNumber = getOrderNumber(state);
    if (!orderNumber) throw new Error('訂單尚未建立短訂單編號');
    const supplierOrderRef = state.supplier_order_ref || buildMicroesimOrderReference(orderNumber, state.id);
    const claimedAt = new Date().toISOString();
    const claimQuery = supabase
      .from('order_items')
      .update({
        supplier_order_ref: supplierOrderRef,
        supplier_status: 'SUBMITTING',
        supplier_last_checked_at: claimedAt,
        supplier_error: null
      })
      .eq('id', state.id)
      .is('inventory_id', null)
      .is('supplier_order_id', null);
    const { data: claimedItems, error: claimError } = state.supplier_status
      ? await claimQuery.eq('supplier_status', state.supplier_status).select('id')
      : await claimQuery.is('supplier_status', null).select('id');
    if (claimError) throw claimError;
    if (!claimedItems?.length) return null;

    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
      const callbackToken = createMicroesimCallbackToken(supplierOrderRef);
      const subscribe = await subscribeMicroesimPlan(planId, {
        customOrderNo: supplierOrderRef,
        notifyUrl: `${siteUrl}/api/microesim/callback?token=${callbackToken}`,
        remark: `FirstRoamLink ${orderNumber}`
      });
      topupId = String(subscribe.topup_id || '').trim();
      await updateSupplierState(supabase, state.id, {
        supplier_order_ref: supplierOrderRef,
        supplier_order_id: topupId,
        supplier_status: 'PROCESSING',
        supplier_last_checked_at: new Date().toISOString(),
        supplier_error: null
      });
    } catch (subscribeError) {
      await updateSupplierState(supabase, state.id, {
        supplier_status: 'FAILED',
        supplier_last_checked_at: new Date().toISOString(),
        supplier_error: subscribeError instanceof Error ? subscribeError.message.slice(0, 500) : 'MicroEsim 下單失敗'
      });
      throw subscribeError;
    }
  }

  let detail: MicroesimTopupDetail;
  try {
    detail = await fetchMicroesimTopupDetail(topupId);
  } catch (detailError) {
    await updateSupplierState(supabase, state.id, {
      supplier_status: 'PROCESSING',
      supplier_last_checked_at: new Date().toISOString(),
      supplier_error: detailError instanceof Error ? detailError.message.slice(0, 500) : 'MicroEsim 明細查詢失敗'
    });
    return null;
  }

  return saveInventory(supabase, state, productId, cost, detail, product);
}

export async function reconcilePendingMicroesimItems(
  supabase: SupabaseLike,
  options: { customerId?: string; limit?: number; minAgeSeconds?: number } = {}
) {
  let query = supabase
    .from('order_items')
    .select(`
      id,
      product_id,
      inventory_id,
      supplier_order_id,
      supplier_last_checked_at,
      orders!inner ( customer_id, payment_status ),
      products ( id, name, supplier, supplier_plan_id, supplier_plan_name, supplier_cost_twd, supplier_raw )
    `)
    .is('inventory_id', null)
    .not('supplier_order_id', 'is', null)
    .eq('orders.payment_status', 'PAID')
    .order('created_at', { ascending: true })
    .limit(options.limit || 5);
  if (options.customerId) query = query.eq('orders.customer_id', options.customerId);

  const { data: items, error } = await query;
  if (error) throw error;

  const cutoff = Date.now() - (options.minAgeSeconds ?? 15) * 1000;
  const dueItems = ((items || []) as unknown as PendingFulfillmentItem[]).filter(item => {
    const checkedAt = item.supplier_last_checked_at ? new Date(item.supplier_last_checked_at).getTime() : 0;
    return !checkedAt || checkedAt <= cutoff;
  });

  const results = await Promise.allSettled(dueItems.map(async item => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!item.product_id || !product?.supplier_plan_id) return null;
    return fulfillMicroesimOrderItem(supabase, item.id, item.product_id, product);
  }));

  return results.filter(result => result.status === 'fulfilled' && Boolean(result.value)).length;
}
