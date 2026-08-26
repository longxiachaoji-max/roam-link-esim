import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEsimCountryInfo } from '@/lib/esim-country-info';
import { compareEsimPlanOrder, compareEsimPlanPriority } from '@/lib/esim-plan-sort';
import { getProductSortIndex, parseProductSortConfig } from '@/lib/product-sort-config';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getHotspotSharing(description: string | null, name: string) {
  if (description?.trim()) return description.trim();
  const match = name.match(/[（(]([^）)]*熱點[^）)]*)[）)]/);
  return match?.[1]?.trim() || '';
}

// GET - 公開 API：回傳 is_active=true 的商品，按國家分組，同流量合併天數選項，依銷量排序
export async function GET() {
  try {
    // 1. 取得所有 active 商品
    const { data, error } = await supabase
      .from('products')
      .select('id, name, country, data_amount, description, validity_days, price, is_hidden_gem')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ products: [], regions: [] });
    }

    const { data: settings } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    const sortConfig = parseProductSortConfig(settings?.usage_guide || '');

    // 2. 從 order_items 計算各 product_id 銷售次數
    const salesMap: Record<string, number> = {};
    const { data: salesData } = await supabase
      .from('order_items')
      .select('product_id');

    if (salesData) {
      for (const row of salesData) {
        salesMap[row.product_id] = (salesMap[row.product_id] || 0) + 1;
      }
    }

    // 3. 按國家分組
    const grouped: Record<string, {
      country: string;
      region: string;
      flag: string;
      totalSales: number;
      isHiddenGem: boolean;
      plansMap: Record<string, { data: string; options: { id: string; days: number; price: number; hotspot_sharing: string }[] }>;
    }> = {};

    for (const item of data) {
      const { flag, region } = getEsimCountryInfo(item.country);
      const productSales = salesMap[item.id] || 0;

      if (!grouped[item.country]) {
        grouped[item.country] = {
          country: item.country,
          region,
          flag,
          totalSales: 0,
          isHiddenGem: false,
          plansMap: {}
        };
      }
      // is_hidden_gem 標記在方案層級，不在國家層級

      grouped[item.country].totalSales += productSales;

      const dataKey = item.data_amount || '標準方案';
      if (!grouped[item.country].plansMap[dataKey]) {
        grouped[item.country].plansMap[dataKey] = {
          data: dataKey,
          options: []
        };
      }

      grouped[item.country].plansMap[dataKey].options.push({
        id: item.id,
        days: item.validity_days,
        price: Number(item.price),
        hotspot_sharing: getHotspotSharing(item.description, item.name)
      });
      // 標記此方案是否為金探子
      if (item.is_hidden_gem) {
        (grouped[item.country].plansMap[dataKey] as any).isHiddenGem = true;
      }
    }

    // 4. 整理輸出格式：options 按 days 排序，國家按 totalSales 降序
    const products = Object.values(grouped)
      .map(g => ({
        country: g.country,
        flag: g.flag,
        region: g.region,
        totalSales: g.totalSales,
        isHiddenGem: false, // 不再在國家層級標記
        plans: Object.values(g.plansMap).map(plan => ({
          data: plan.data,
          isHiddenGem: (plan as any).isHiddenGem || false,
          options: plan.options.sort((a, b) => a.days - b.days)
        })).sort((a, b) => {
          const priority = compareEsimPlanPriority(a.data, b.data);
          if (priority !== 0) return priority;
          const planA = getProductSortIndex(sortConfig.plans, `${g.country}|${a.data}`);
          const planB = getProductSortIndex(sortConfig.plans, `${g.country}|${b.data}`);
          if (planA !== planB) return planA - planB;
          return compareEsimPlanOrder(a.data, b.data);
        })
      }))
      .sort((a, b) => {
        const countryA = getProductSortIndex(sortConfig.countries, a.country);
        const countryB = getProductSortIndex(sortConfig.countries, b.country);
        if (countryA !== countryB) return countryA - countryB;
        if (a.totalSales !== b.totalSales) return b.totalSales - a.totalSales;
        return a.country.localeCompare(b.country, 'zh-Hant');
      });

    // 5. 收集所有出現的 regions
    const regionSet = new Set(products.map(p => p.region));
    const regions = ['全部', ...Array.from(regionSet).sort()];

    return NextResponse.json({ products, regions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
