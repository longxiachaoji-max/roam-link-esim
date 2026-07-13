import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchMicroesimPlanPage, transformMicroesimPlan } from '@/lib/microesim';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type LinkedProduct = {
  id: string;
  name: string;
  supplier_plan_id: string | null;
  supplier_cost_twd: number | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const hkdRate = Number(body.hkdRate || 4.15);
    const usdRate = Number(body.usdRate || 32.5);
    const maxPages = Math.max(1, Math.min(Number(body.maxPages || 60), 80));

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, supplier_plan_id, supplier_cost_twd')
      .not('supplier_plan_id', 'is', null);

    if (productError) {
      if (/supplier_plan_id|column/i.test(productError.message || '')) {
        return NextResponse.json({
          error: '正式資料庫尚未建立 MicroEsim 商品欄位，請先在 Supabase SQL Editor 執行 supplier 欄位 migration'
        }, { status: 400 });
      }
      return NextResponse.json({ error: productError.message }, { status: 500 });
    }

    const linkedProducts = (products || []).filter(product => product.supplier_plan_id) as LinkedProduct[];
    if (linkedProducts.length === 0) {
      return NextResponse.json({
        success: true,
        scanned: 0,
        linkedProducts: 0,
        updated: 0,
        unchanged: 0,
        missing: 0,
        message: '目前沒有已連結 MicroEsim ID 的商品'
      });
    }

    const neededIds = new Set(linkedProducts.map(product => product.supplier_plan_id as string));
    const firstPage = await fetchMicroesimPlanPage(1, 500);
    const totalPages = Math.min(firstPage.totalPages || 1, maxPages);
    const supplierPlans = [...(firstPage.list || [])];

    for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
      const page = await fetchMicroesimPlanPage(pageNo, 500);
      supplierPlans.push(...(page.list || []));

      const foundCount = supplierPlans.filter(plan => neededIds.has(plan.channel_dataplan_id)).length;
      if (foundCount >= neededIds.size) break;
    }

    const supplierPlanMap = new Map(
      supplierPlans
        .filter(plan => neededIds.has(plan.channel_dataplan_id))
        .map(plan => {
          const transformed = transformMicroesimPlan(plan, { hkdRate, usdRate });
          return [transformed.supplier_plan_id, transformed];
        })
    );

    let updated = 0;
    let unchanged = 0;
    let missing = 0;
    const failed: { id: string; name: string; reason: string }[] = [];

    for (const product of linkedProducts) {
      const plan = supplierPlanMap.get(product.supplier_plan_id as string);
      if (!plan) {
        missing += 1;
        continue;
      }

      const nextCost = Number(plan.cost_twd || 0);
      const currentCost = Number(product.supplier_cost_twd || 0);
      const updatePayload = {
        supplier: 'microesim',
        supplier_plan_name: plan.supplier_plan_name,
        supplier_cost_twd: nextCost,
        supplier_cost_currency: plan.cost_currency,
        supplier_cost_original: plan.cost_original,
        supplier_raw: plan.raw
      };

      if (currentCost === nextCost) {
        const { error: refreshError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', product.id);

        if (refreshError) {
          failed.push({ id: product.id, name: product.name, reason: refreshError.message });
          continue;
        }
        unchanged += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', product.id);

      if (updateError) {
        failed.push({ id: product.id, name: product.name, reason: updateError.message });
        continue;
      }
      updated += 1;
    }

    return NextResponse.json({
      success: failed.length === 0,
      scanned: supplierPlans.length,
      linkedProducts: linkedProducts.length,
      updated,
      unchanged,
      missing,
      failed: failed.length,
      failedItems: failed
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '同步 MicroEsim 成本失敗'
    }, { status: 500 });
  }
}
