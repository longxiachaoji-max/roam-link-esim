import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEsimCountryInfo } from '@/lib/esim-country-info';
import { getProductSortIndex, parseProductSortConfig } from '@/lib/product-sort-config';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const REGION_ORDER = ['亞洲', '歐洲', '美洲', '大洋洲', '其他'];

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '網站資料來源尚未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const countrySet = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('products')
        .select('country')
        .eq('is_active', true)
        .order('country', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      for (const row of data || []) {
        const country = String(row.country || '').trim();
        if (country) countrySet.add(country);
      }
      if (!data || data.length < PAGE_SIZE) break;
    }

    const { data: settings } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .maybeSingle();
    const sortConfig = parseProductSortConfig(settings?.usage_guide || '');

    const destinations = [...countrySet]
      .sort((a, b) => {
        const sortA = getProductSortIndex(sortConfig.countries, a);
        const sortB = getProductSortIndex(sortConfig.countries, b);
        if (sortA !== sortB) return sortA - sortB;
        return a.localeCompare(b, 'zh-Hant');
      })
      .map(country => ({ country, ...getEsimCountryInfo(country) }));
    const availableRegions = new Set(destinations.map(item => item.region));
    const regions = [
      '全部',
      ...REGION_ORDER.filter(region => availableRegions.has(region)),
      ...[...availableRegions].filter(region => !REGION_ORDER.includes(region)).sort()
    ];

    return NextResponse.json({ destinations, regions });
  } catch (error) {
    console.error('Public eSIM destinations failed:', error);
    return NextResponse.json({ error: '暫時無法載入目的地' }, { status: 500 });
  }
}
