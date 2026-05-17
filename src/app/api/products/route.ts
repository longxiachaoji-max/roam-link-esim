import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// GET - 公開 API：回傳 is_active=true 的商品，按國家分組
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, country, data_amount, validity_days, price')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ products: [], regions: [] });
    }

    // 按國家分組，格式與前端現有結構相容
    const grouped: Record<string, {
      country: string;
      region: string;
      flag: string;
      plans: { id: string; data: string; days: string; price: number }[];
    }> = {};

    for (const item of data) {
      const { flag, region } = getCountryInfo(item.country);

      if (!grouped[item.country]) {
        grouped[item.country] = {
          country: item.country,
          region,
          flag,
          plans: []
        };
      }

      grouped[item.country].plans.push({
        id: item.id,
        data: item.data_amount || '標準方案',
        days: `${item.validity_days}天`,
        price: Number(item.price)
      });
    }

    const products = Object.values(grouped);

    // 收集所有出現的 regions（用於前端 filter tabs）
    const regionSet = new Set(products.map(p => p.region));
    const regions = ['全部', ...Array.from(regionSet).sort()];

    return NextResponse.json({ products, regions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
