import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

type ProductTextUpdate = {
  id?: string;
  name?: string;
  data_amount?: string | null;
  description?: string | null;
};

const allowedFields = ['name', 'data_amount', 'description'] as const;

export async function POST(request: Request) {
  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '沒有要更新的商品' }, { status: 400 });
    }

    if (updates.length > 300) {
      return NextResponse.json({ error: '一次最多更新 300 筆商品' }, { status: 400 });
    }

    const supabase = getSupabase();
    let updated = 0;
    const failed: { id?: string; reason: string }[] = [];

    for (const item of updates as ProductTextUpdate[]) {
      if (!item.id) {
        failed.push({ reason: '缺少商品 ID' });
        continue;
      }

      const updateData: Record<string, string | null> = {};
      for (const field of allowedFields) {
        if (field in item) {
          updateData[field] = item[field] ?? null;
        }
      }

      if (Object.keys(updateData).length === 0) {
        failed.push({ id: item.id, reason: '沒有可更新欄位' });
        continue;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', item.id);

      if (error) {
        failed.push({ id: item.id, reason: error.message });
        continue;
      }

      updated++;
    }

    return NextResponse.json({
      success: failed.length === 0,
      updated,
      failed: failed.length,
      failedItems: failed
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '批量更新失敗' }, { status: 500 });
  }
}
