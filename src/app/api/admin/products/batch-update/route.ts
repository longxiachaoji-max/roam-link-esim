import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

type ProductTextUpdate = {
  id?: string;
  country?: string | null;
  name?: string;
  data_amount?: string | null;
  validity_days?: number | string | null;
  price?: number | string | null;
  description?: string | null;
  internal_note?: string | null;
};

const textFields = ['name', 'country', 'data_amount', 'description', 'internal_note'] as const;

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
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

      const updateData: Record<string, string | number | null> = {};
      for (const field of textFields) {
        if (field in item) {
          updateData[field] = item[field] ?? null;
        }
      }
      if ('validity_days' in item) {
        const days = Number(item.validity_days);
        if (!Number.isFinite(days) || days < 1) {
          failed.push({ id: item.id, reason: '有效天數格式錯誤' });
          continue;
        }
        updateData.validity_days = days;
      }
      if ('price' in item) {
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) {
          failed.push({ id: item.id, reason: '價格格式錯誤' });
          continue;
        }
        updateData.price = price;
      }

      if (Object.keys(updateData).length === 0) {
        failed.push({ id: item.id, reason: '沒有可更新欄位' });
        continue;
      }

      let { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', item.id);

      if (error && /internal_note|column/i.test(error.message || '')) {
        delete updateData.internal_note;
        const fallback = await supabase
          .from('products')
          .update(updateData)
          .eq('id', item.id);
        error = fallback.error;
      }

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
