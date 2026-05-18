import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST - 批量新增 eSIM 庫存 (用 activation_code 判斷重複)
export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '沒有資料' }, { status: 400 });
    }

    // 取得現有 activation_code 和 iccid
    const { data: existing } = await supabase
      .from('e_sim_inventory')
      .select('activation_code, iccid');

    const existingCodes = new Set(
      (existing || []).map(e => e.activation_code)
    );
    const existingIccids = new Set(
      (existing || []).filter(e => e.iccid).map(e => e.iccid)
    );

    // 取得 products 表做 name → id 映射
    const { data: products } = await supabase
      .from('products')
      .select('id, name');

    const productMap = new Map<string, string>();
    for (const p of products || []) {
      productMap.set(p.name, p.id);
    }

    const toInsert = [];
    const skipped = [];

    for (const item of items) {
      if (!item.smdp_address || !item.activation_code) {
        skipped.push({ ...item, reason: '缺少 SM-DP+ 或啟用碼' });
        continue;
      }

      if (existingCodes.has(item.activation_code)) {
        skipped.push({ ...item, reason: '啟用碼已存在' });
        continue;
      }

      if (item.iccid && existingIccids.has(item.iccid)) {
        skipped.push({ ...item, reason: 'ICCID 已存在' });
        continue;
      }

      // 防止同批次重複
      existingCodes.add(item.activation_code);
      if (item.iccid) existingIccids.add(item.iccid);

      // 嘗試用商品名稱匹配 product_id
      let productId = item.product_id || null;
      if (!productId && item.product_name) {
        productId = productMap.get(item.product_name) || null;
      }

      toInsert.push({
        product_id: productId,
        iccid: (item.iccid && item.iccid.trim()) ? item.iccid.trim() : null,
        smdp_address: item.smdp_address,
        activation_code: item.activation_code,
        cost: item.cost !== undefined && item.cost !== '' ? Number(item.cost) : 0,
        status: 'AVAILABLE',
        expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString() : new Date('2026-12-31').toISOString()
      });
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      // 分批插入 (每批 50 筆)
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase.from('e_sim_inventory').insert(batch);
        if (error) {
          return NextResponse.json({ 
            error: error.message, 
            insertedSoFar: inserted,
            failedAt: i
          }, { status: 500 });
        }
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: skipped.length,
      skippedItems: skipped,
      total: items.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
