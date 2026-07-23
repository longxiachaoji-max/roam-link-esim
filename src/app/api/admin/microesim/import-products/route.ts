import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';
import type { TransformedMicroesimPlan } from '@/lib/microesim';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type ExistingProduct = {
  id: string;
  name: string;
  country: string;
  validity_days: number;
  supplier_plan_id?: string | null;
};

function cleanPlan(plan: Partial<TransformedMicroesimPlan>) {
  const price = Number(plan.price || plan.suggested_price || 0);
  const customerNote = String(plan.hotspot_sharing || plan.customer_note || '').trim();
  const internalNoteParts = [
    plan.internal_warning,
    plan.special_desc_zh,
    plan.rule_desc_zh,
    plan.active_type_note,
    plan.supplier_plan_name
  ].filter(Boolean);

  return {
    name: String(plan.name || '').trim(),
    country: String(plan.country || '韓國').trim(),
    data_amount: String(plan.data_amount || '').trim(),
    validity_days: Number(plan.validity_days || 0),
    price,
    description: customerNote || null,
    internal_note: Array.from(new Set(internalNoteParts)).join('｜') || null,
    is_active: true,
    supplier: 'microesim',
    supplier_plan_id: String(plan.supplier_plan_id || '').trim(),
    supplier_plan_name: String(plan.supplier_plan_name || '').trim(),
    supplier_cost_twd: Number(plan.cost_twd || 0),
    supplier_cost_currency: String(plan.cost_currency || '').trim(),
    supplier_cost_original: Number(plan.cost_original || 0),
    supplier_raw: plan.raw || null
  };
}

function stripSupplierColumns(product: ReturnType<typeof cleanPlan>) {
  return {
    name: product.name,
    country: product.country,
    data_amount: product.data_amount,
    validity_days: product.validity_days,
    price: product.price,
    description: product.description,
    internal_note: product.internal_note,
    is_active: product.is_active
  };
}

function stripInternalNote<T extends { internal_note?: string | null }>(product: T) {
  const { internal_note: _internalNote, ...rest } = product;
  return rest;
}

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { plans } = await request.json();
    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ error: '沒有選擇要上架的方案' }, { status: 400 });
    }

    let usedBasicFallback = false;
    let hasSupplierColumns = true;
    let existingProducts: ExistingProduct[] | null = null;
    let existingError: { message?: string } | null = null;
    const existingResult = await supabase
      .from('products')
      .select('id, name, country, validity_days, supplier_plan_id');
    existingProducts = existingResult.data;
    existingError = existingResult.error;

    if (existingError && /supplier_plan_id|column/i.test(existingError.message || '')) {
      hasSupplierColumns = false;
      usedBasicFallback = true;
      const fallback = await supabase
        .from('products')
        .select('id, name, country, validity_days');
      existingProducts = fallback.data;
      existingError = fallback.error;
    }

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingKeys = new Set<string>();
    const existingSupplierIds = new Set<string>();
    const existingByKey = new Map<string, ExistingProduct>();
    for (const product of existingProducts || []) {
      const key = `${product.name}||${product.country}||${product.validity_days}`;
      existingKeys.add(key);
      if (!existingByKey.has(key)) existingByKey.set(key, product);
      if (hasSupplierColumns && product.supplier_plan_id) existingSupplierIds.add(product.supplier_plan_id);
    }

    const toInsert = [];
    const toLinkExisting: { id: string; product: ReturnType<typeof cleanPlan> }[] = [];
    const skipped = [];

    for (const rawPlan of plans) {
      const product = cleanPlan(rawPlan);
      if (!product.name || !product.country || !product.validity_days || !product.price || !product.supplier_plan_id) {
        skipped.push({ name: rawPlan?.name || '未命名方案', reason: '缺少必要欄位' });
        continue;
      }

      const key = `${product.name}||${product.country}||${product.validity_days}`;
      if (existingSupplierIds.has(product.supplier_plan_id)) {
        skipped.push({ name: product.name, reason: '供應商方案已匯入' });
        continue;
      }
      if (existingKeys.has(key)) {
        const existingProduct = existingByKey.get(key);
        if (hasSupplierColumns && existingProduct?.id && !existingProduct.supplier_plan_id) {
          toLinkExisting.push({ id: existingProduct.id, product });
          existingSupplierIds.add(product.supplier_plan_id);
          continue;
        }
        skipped.push({ name: product.name, reason: '已存在相同商品名稱/國家/天數' });
        continue;
      }

      existingKeys.add(key);
      existingSupplierIds.add(product.supplier_plan_id);
      toInsert.push(product);
    }

    if (toInsert.length === 0 && toLinkExisting.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, linked: 0, skipped: skipped.length, skippedItems: skipped });
    }

    let insertError: { message?: string } | null = null;
    if (toInsert.length > 0) {
      const insertPayload = hasSupplierColumns ? toInsert : toInsert.map(stripSupplierColumns);
      const { error } = await supabase.from('products').insert(insertPayload);
      insertError = error;

      if (insertError && /supplier_|supplier|column/i.test(insertError.message || '')) {
        usedBasicFallback = true;
        const basicProducts = toInsert.map(stripSupplierColumns);
        const fallback = await supabase.from('products').insert(basicProducts);
        insertError = fallback.error;
      }

      if (insertError && /internal_note|column/i.test(insertError.message || '')) {
        const withoutInternalNote = insertPayload.map(stripInternalNote);
        const fallback = await supabase.from('products').insert(withoutInternalNote);
        insertError = fallback.error;
      }

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    let linked = 0;
    if (hasSupplierColumns && toLinkExisting.length > 0) {
      for (const item of toLinkExisting) {
        const updatePayload = {
          supplier: item.product.supplier,
          supplier_plan_id: item.product.supplier_plan_id,
          supplier_plan_name: item.product.supplier_plan_name,
          supplier_cost_twd: item.product.supplier_cost_twd,
          supplier_cost_currency: item.product.supplier_cost_currency,
          supplier_cost_original: item.product.supplier_cost_original,
          supplier_raw: item.product.supplier_raw
        };
        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', item.id);

        if (updateError) {
          skipped.push({ name: item.product.name, reason: `補上供應商連結失敗：${updateError.message}` });
          continue;
        }
        linked++;
      }
    }

    return NextResponse.json({
      success: true,
      inserted: toInsert.length,
      linked,
      skipped: skipped.length,
      skippedItems: skipped,
      usedBasicFallback
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '上架 MicroEsim 方案失敗'
    }, { status: 500 });
  }
}
