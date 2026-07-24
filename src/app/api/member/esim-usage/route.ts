import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchMicroesimDeviceDetail,
  fetchMicroesimEventDetail,
  getMicroesimInstallationDeadline
} from '@/lib/microesim';
import { normalizeMicroesimUsage } from '@/lib/microesim-usage';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type UsageRelation<T> = T | T[] | null;
interface UsageOrderRelation { customer_id: string; payment_status: string; created_at: string; }
interface UsageProductRelation { supplier?: string | null; supplier_raw?: Record<string, unknown> | null; }
interface UsageInventoryRelation {
  id: string;
  iccid: string | null;
  expiry_date: string | null;
  microesim_topup_id: string | null;
  microesim_usage_cache: unknown;
  microesim_usage_checked_at: string | null;
}
interface UsageItemResult {
  orders: UsageRelation<UsageOrderRelation>;
  products: UsageRelation<UsageProductRelation>;
  e_sim_inventory: UsageRelation<UsageInventoryRelation>;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { order_item_id } = await request.json();
    const email = user.email.toLowerCase();

    if (!order_item_id) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (!customer) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select(`
        id,
        inventory_id,
        orders!inner(customer_id, payment_status, created_at),
        products ( supplier, supplier_raw ),
        e_sim_inventory (
          id,
          iccid,
          expiry_date,
          microesim_topup_id,
          microesim_usage_cache,
          microesim_usage_checked_at
        )
      `)
      .eq('id', order_item_id)
      .single();

    const relations = item as unknown as UsageItemResult | null;
    const orderRecord = relations?.orders;
    const order = Array.isArray(orderRecord) ? orderRecord[0] : orderRecord;
    const productRecord = relations?.products;
    const product = Array.isArray(productRecord) ? productRecord[0] : productRecord;
    const inventoryRecord = relations?.e_sim_inventory;
    const inventory = Array.isArray(inventoryRecord) ? inventoryRecord[0] : inventoryRecord;

    if (itemError || !item || order?.customer_id !== customer.id || order?.payment_status !== 'PAID') {
      return NextResponse.json({ error: '無權限查詢此 eSIM' }, { status: 403 });
    }

    if (!inventory?.microesim_topup_id || !inventory?.iccid) {
      return NextResponse.json({
        error: '這張 eSIM 沒有完整的 MicroEsim 查詢資料，可能是手動庫存或舊訂單'
      }, { status: 400 });
    }

    try {
      const installationDeadline = inventory.expiry_date || getMicroesimInstallationDeadline(product, null, order.created_at) || null;
      const [detail, events] = await Promise.all([
        fetchMicroesimDeviceDetail(inventory.microesim_topup_id, inventory.iccid),
        fetchMicroesimEventDetail(inventory.iccid).catch(error => {
          console.error('MicroEsim event query failed:', error);
          return [];
        })
      ]);
      const usage = normalizeMicroesimUsage(detail, events, installationDeadline);

      await supabase
        .from('e_sim_inventory')
        .update({
          expiry_date: installationDeadline,
          microesim_usage_cache: usage,
          microesim_usage_checked_at: new Date().toISOString()
        })
        .eq('id', inventory.id);

      return NextResponse.json({
        success: true,
        usage,
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      if (inventory.microesim_usage_cache) {
        return NextResponse.json({
          success: true,
          stale: true,
          usage: inventory.microesim_usage_cache,
          checkedAt: inventory.microesim_usage_checked_at,
          warning: error instanceof Error ? error.message : 'MicroEsim 查詢暫時失敗'
        });
      }
      throw error;
    }
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('MicroEsim usage query failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '查詢 eSIM 用量失敗'
    }, { status: 500 });
  }
}
