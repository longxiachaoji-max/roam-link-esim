import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { ids } = await request.json();
    const productIds = Array.isArray(ids)
      ? Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)))
      : [];

    if (productIds.length === 0) {
      return NextResponse.json({ error: '沒有選擇商品' }, { status: 400 });
    }

    const { data: inventoryData, error: inventoryError } = await supabase
      .from('e_sim_inventory')
      .select('id')
      .in('product_id', productIds);

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 500 });
    }

    const inventoryIds = (inventoryData || []).map((inventory: { id: string }) => inventory.id);

    const { error: productItemError } = await supabase
      .from('order_items')
      .update({ product_id: null })
      .in('product_id', productIds);

    if (productItemError) {
      return NextResponse.json({ error: productItemError.message }, { status: 500 });
    }

    if (inventoryIds.length > 0) {
      const { error: inventoryItemError } = await supabase
        .from('order_items')
        .update({ inventory_id: null })
        .in('inventory_id', inventoryIds);

      if (inventoryItemError) {
        return NextResponse.json({ error: inventoryItemError.message }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .in('id', productIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: productIds.length,
      deletedInventoryCount: inventoryIds.length,
      warning: inventoryIds.length > 0 ? `已連帶刪除 ${inventoryIds.length} 筆庫存` : undefined
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '批量刪除商品失敗'
    }, { status: 500 });
  }
}
