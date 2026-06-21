import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const HIDDEN_CONFIG_PATTERN = /\n?(<!--(?:PRODUCT_SORT_CONFIG|NOTIFICATION_SETTINGS|CONTACT_INFO|TRAFFIC_ANALYTICS):[\s\S]*?-->)\n?/g;

function stripSortConfig(usageGuide: string | null) {
  return (usageGuide || '').replace(HIDDEN_CONFIG_PATTERN, '').trim();
}

function getHiddenConfigComments(usageGuide: string | null) {
  return Array.from((usageGuide || '').matchAll(HIDDEN_CONFIG_PATTERN)).map(match => match[1]).filter(Boolean);
}

function withExistingSortConfig(nextUsageGuide: string, currentUsageGuide: string | null) {
  const hiddenConfigComments = getHiddenConfigComments(currentUsageGuide);
  const cleanGuide = stripSortConfig(nextUsageGuide);
  return `${cleanGuide}${hiddenConfigComments.length ? `${cleanGuide ? '\n\n' : ''}${hiddenConfigComments.join('\n\n')}` : ''}`;
}

// GET - 取得網站設定
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

// PUT - 更新網站設定
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { hero_badge, hero_title, hero_subtitle, section_title, usage_guide } = body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (hero_badge !== undefined) updateData.hero_badge = hero_badge;
    if (hero_title !== undefined) updateData.hero_title = hero_title;
    if (hero_subtitle !== undefined) updateData.hero_subtitle = hero_subtitle;
    if (section_title !== undefined) updateData.section_title = section_title;
    if (usage_guide !== undefined) {
      const { data } = await supabase
        .from('site_settings')
        .select('usage_guide')
        .eq('id', 'main')
        .single();

      updateData.usage_guide = withExistingSortConfig(usage_guide, data?.usage_guide || '');
    }

    const { error } = await supabase
      .from('site_settings')
      .update(updateData)
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
