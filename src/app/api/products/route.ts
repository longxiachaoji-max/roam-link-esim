import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 國家 → flag emoji + region 映射
const COUNTRY_MAP: Record<string, { flag: string; region: string }> = {
  '日本': { flag: '🇯🇵', region: '亞洲' },
  '韓國': { flag: '🇰🇷', region: '亞洲' },
  '泰國': { flag: '🇹🇭', region: '亞洲' },
  '越南': { flag: '🇻🇳', region: '亞洲' },
  '新加坡': { flag: '🇸🇬', region: '亞洲' },
  '馬來西亞': { flag: '🇲🇾', region: '亞洲' },
  '中國': { flag: '🇨🇳', region: '亞洲' },
  '香港': { flag: '🇭🇰', region: '亞洲' },
  '台灣': { flag: '🇹🇼', region: '亞洲' },
  '印度': { flag: '🇮🇳', region: '亞洲' },
  '印尼': { flag: '🇮🇩', region: '亞洲' },
  '菲律賓': { flag: '🇵🇭', region: '亞洲' },
  '柬埔寨': { flag: '🇰🇭', region: '亞洲' },
  '美國': { flag: '🇺🇸', region: '美洲' },
  '加拿大': { flag: '🇨🇦', region: '美洲' },
  '墨西哥': { flag: '🇲🇽', region: '美洲' },
  '巴西': { flag: '🇧🇷', region: '美洲' },
  '法國': { flag: '🇫🇷', region: '歐洲' },
  '英國': { flag: '🇬🇧', region: '歐洲' },
  '德國': { flag: '🇩🇪', region: '歐洲' },
  '義大利': { flag: '🇮🇹', region: '歐洲' },
  '西班牙': { flag: '🇪🇸', region: '歐洲' },
  '荷蘭': { flag: '🇳🇱', region: '歐洲' },
  '瑞士': { flag: '🇨🇭', region: '歐洲' },
  '土耳其': { flag: '🇹🇷', region: '歐洲' },
  '澳洲': { flag: '🇦🇺', region: '大洋洲' },
  '紐西蘭': { flag: '🇳🇿', region: '大洋洲' },
};

function getCountryInfo(country: string) {
  return COUNTRY_MAP[country] || { flag: '🌍', region: '其他' };
}

// GET - 公開 API：回傳 is_active=true 的商品，按國家分組，同流量合併天數選項，依銷量排序
export async function GET() {
  try {
    // 1. 取得所有 active 商品
    const { data, error } = await supabase
      .from('products')
      .select('id, name, country, data_amount, validity_days, price, is_hidden_gem')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ products: [], regions: [] });
    }

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
      plansMap: Record<string, { data: string; options: { id: string; days: number; price: number }[] }>;
    }> = {};

    for (const item of data) {
      const { flag, region } = getCountryInfo(item.country);
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
      if (item.is_hidden_gem) grouped[item.country].isHiddenGem = true;

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
        price: Number(item.price)
      });
    }

    // 4. 整理輸出格式：options 按 days 排序，國家按 totalSales 降序
    const products = Object.values(grouped)
      .map(g => ({
        country: g.country,
        flag: g.flag,
        region: g.region,
        totalSales: g.totalSales,
        isHiddenGem: g.isHiddenGem,
        plans: Object.values(g.plansMap).map(plan => ({
          data: plan.data,
          options: plan.options.sort((a, b) => a.days - b.days)
        }))
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // 5. 收集所有出現的 regions
    const regionSet = new Set(products.map(p => p.region));
    const regions = ['全部', ...Array.from(regionSet).sort()];

    return NextResponse.json({ products, regions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
