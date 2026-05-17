import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET - 取得所有庫存
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('e_sim_inventory')
      .select('id, iccid, smdp_address, activation_code, status, expiry_date, product_id, products(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inventory: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - 新增 eSIM
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, iccid, smdp_address, activation_code, expiry_date } = body;

    if (!product_id || !smdp_address || !activation_code || !expiry_date) {
      return NextResponse.json({ error: '缺少必要欄位 (product_id, smdp_address, activation_code, expiry_date)' }, { status: 400 });
    }

    const insertData: any = {
      product_id,
      smdp_address,
      activation_code,
      status: 'AVAILABLE',
      iccid: (iccid && iccid.trim()) ? iccid.trim() : null,
      expiry_date: new Date(expiry_date).toISOString()
    };

    const { data, error } = await supabase
      .from('e_sim_inventory')
      .insert(insertData)
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

// PUT - 更新 eSIM
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, product_id, iccid, smdp_address, activation_code, status, expiry_date } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('e_sim_inventory')
      .update({
        product_id,
        iccid: (iccid && iccid.trim()) ? iccid.trim() : null,
        smdp_address,
        activation_code,
        status,
        expiry_date: new Date(expiry_date).toISOString()
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - 刪除 eSIM
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    // 先清除 order_items 中的參照（將 inventory_id 設為 null）
    await supabase
      .from('order_items')
      .update({ inventory_id: null })
      .eq('inventory_id', id);

    const { error } = await supabase
      .from('e_sim_inventory')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
