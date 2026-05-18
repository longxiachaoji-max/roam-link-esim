import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST - 批量新增商品 (自動排除重複)
export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '沒有資料' }, { status: 400 });
    }

    // 取得現有商品 (用 name+country+validity_days 判斷重複)
    const { data: existing } = await supabase
      .from('products')
      .select('name, country, validity_days');

    const existingSet = new Set(
      (existing || []).map(p => `${p.name}||${p.country}||${p.validity_days}`)
    );

    const toInsert = [];
    const skipped = [];

    for (const item of items) {
      if (!item.name || !item.country || !item.validity_days || item.price === undefined) {
        skipped.push({ ...item, reason: '缺少必要欄位' });
        continue;
      }

      const key = `${item.name}||${item.country}||${item.validity_days}`;
      if (existingSet.has(key)) {
        skipped.push({ ...item, reason: '已存在相同商品' });
        continue;
      }

      // 防止同批次重複
      existingSet.add(key);

      toInsert.push({
        name: item.name,
        country: item.country,
        data_amount: item.data_amount || null,
        validity_days: Number(item.validity_days),
        price: Number(item.price),
        description: item.description || null,
        is_active: true
      });
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error } = await supabase.from('products').insert(toInsert);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      inserted = toInsert.length;
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
