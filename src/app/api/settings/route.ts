import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const SORT_CONFIG_PATTERN = /\n?<!--PRODUCT_SORT_CONFIG:[\s\S]*?-->\n?/;

function stripSortConfig(usageGuide: string | null) {
  return (usageGuide || '').replace(SORT_CONFIG_PATTERN, '').trim();
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_badge, hero_title, hero_subtitle, section_title, usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      // 回傳預設值
      return NextResponse.json({
        settings: {
          hero_badge: '一飛通全球漫遊 · 2026 全新上線',
          hero_title: '隨時隨地，全球無縫連線',
          hero_subtitle: '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
          section_title: '熱門目的地',
          usage_guide: ''
        }
      });
    }

    return NextResponse.json({
      settings: {
        ...data,
        usage_guide: stripSortConfig(data.usage_guide)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
