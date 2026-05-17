import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET - 取得所有商品（含 is_active=false），按 country 排序
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('country', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 計算各商品的庫存數量
    const { data: inventoryCounts } = await supabase
      .from('e_sim_inventory')
      .select('product_id, status');

    const stockMap: Record<string, { available: number; total: number }> = {};
    if (inventoryCounts) {
      for (const inv of inventoryCounts) {
        if (!stockMap[inv.product_id]) {
          stockMap[inv.product_id] = { available: 0, total: 0 };
        }
        stockMap[inv.product_id].total++;
        if (inv.status === 'AVAILABLE') {
          stockMap[inv.product_id].available++;
        }
      }
    }

    const productsWithStock = (data || []).map((p: any) => ({
      ...p,
      stock: stockMap[p.id] || { available: 0, total: 0 }
    }));

    return NextResponse.json({ products: productsWithStock });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - 新增商品
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, country, data_limit, validity_days, price, is_active } = body;

    if (!name || !country || !validity_days || price === undefined) {
      return NextResponse.json({ error: '缺少必要欄位 (name, country, validity_days, price)' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        country,
        data_limit: data_limit || null,
        validity_days: Number(validity_days),
        price: Number(price),
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - 更新商品
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, country, data_limit, validity_days, price, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (country !== undefined) updateData.country = country;
    if (data_limit !== undefined) updateData.data_limit = data_limit;
    if (validity_days !== undefined) updateData.validity_days = Number(validity_days);
    if (price !== undefined) updateData.price = Number(price);
    if (is_active !== undefined) updateData.is_active = is_active;

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - 刪除商品（會連帶刪除庫存，因為 FK ON DELETE CASCADE）
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    // 查詢該商品下的庫存數量以回傳警告資訊
    const { data: inventoryData } = await supabase
      .from('e_sim_inventory')
      .select('id')
      .eq('product_id', id);

    const inventoryCount = inventoryData?.length || 0;

    // 先清除 order_items 中參照到該商品庫存的 inventory_id
    if (inventoryCount > 0) {
      const inventoryIds = inventoryData!.map((inv: any) => inv.id);
      await supabase
        .from('order_items')
        .update({ inventory_id: null })
        .in('inventory_id', inventoryIds);
    }

    // 刪除商品（e_sim_inventory 會因 ON DELETE CASCADE 而自動刪除）
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      deletedInventoryCount: inventoryCount,
      warning: inventoryCount > 0 ? `已連帶刪除 ${inventoryCount} 筆庫存` : undefined
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
