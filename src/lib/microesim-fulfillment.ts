import { createMicroesimInventoryForPlan, getMicroesimProductPlanId, type MicroesimProductLink } from '@/lib/microesim';

interface SupabaseLike {
  from: (table: string) => any;
}

export interface MicroesimFulfillmentProduct extends MicroesimProductLink {
  id?: string | null;
  supplier_cost_twd?: number | string | null;
}

export async function fulfillMicroesimOrderItem(
  supabase: SupabaseLike,
  orderItemId: string,
  productId: string,
  product: MicroesimFulfillmentProduct | null | undefined
) {
  const planId = getMicroesimProductPlanId(product);
  if (!planId) return null;

  const cost = Number(product?.supplier_cost_twd || 0);
  const esim = await createMicroesimInventoryForPlan(planId, Number.isFinite(cost) ? cost : 0);
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const inventoryPayload = {
    product_id: productId,
    iccid: esim.iccid,
    smdp_address: esim.smdp_address,
    activation_code: esim.activation_code,
    status: 'SOLD',
    sold_at: new Date().toISOString(),
    expiry_date: expiresAt.toISOString(),
    cost: esim.cost,
    microesim_topup_id: esim.topup_id
  };

  let { data: inventory, error: inventoryError } = await supabase
    .from('e_sim_inventory')
    .insert(inventoryPayload)
    .select('*')
    .single();

  if (inventoryError && esim.iccid && /duplicate|unique|iccid/i.test(inventoryError.message || '')) {
    const retryResult = await supabase
      .from('e_sim_inventory')
      .insert({ ...inventoryPayload, iccid: null })
      .select('*')
      .single();
    inventory = retryResult.data;
    inventoryError = retryResult.error;
  }

  if (inventoryError || !inventory) {
    throw inventoryError || new Error('新增 MicroEsim 庫存失敗');
  }

  const { data: updatedItems, error: itemUpdateError } = await supabase
    .from('order_items')
    .update({ inventory_id: inventory.id })
    .eq('id', orderItemId)
    .is('inventory_id', null)
    .select('id');

  if (itemUpdateError || !updatedItems?.length) {
    await supabase.from('e_sim_inventory').delete().eq('id', inventory.id);
    if (itemUpdateError) throw itemUpdateError;
    return null;
  }

  return inventory;
}
