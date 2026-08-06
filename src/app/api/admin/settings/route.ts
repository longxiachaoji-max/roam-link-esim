import { NextResponse } from 'next/server';
import { adminApiGuard, getServerSupabase } from '@/lib/server-auth';
import { parseHomeCarousel, withHomeCarousel } from '@/lib/home-carousel';
import { getHiddenSiteConfigComments, stripHiddenSiteConfig } from '@/lib/site-settings-hidden-config';

export const dynamic = 'force-dynamic';

function withExistingSortConfig(nextUsageGuide: string, currentUsageGuide: string | null) {
  const hiddenConfigComments = getHiddenSiteConfigComments(currentUsageGuide);
  const cleanGuide = stripHiddenSiteConfig(nextUsageGuide);
  return `${cleanGuide}${hiddenConfigComments.length ? `${cleanGuide ? '\n\n' : ''}${hiddenConfigComments.join('\n\n')}` : ''}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '網站設定操作失敗';
}

// GET - 取得網站設定
export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const supabase = getServerSupabase();
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
        usage_guide: stripHiddenSiteConfig(data.usage_guide),
        home_carousel: parseHomeCarousel(data.usage_guide)
      }
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// PUT - 更新網站設定
export async function PUT(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { hero_badge, hero_title, hero_subtitle, section_title, usage_guide, home_carousel } = body;
    const supabase = getServerSupabase();

    const updateData: Record<string, string> = { updated_at: new Date().toISOString() };
    if (hero_badge !== undefined) updateData.hero_badge = hero_badge;
    if (hero_title !== undefined) updateData.hero_title = hero_title;
    if (hero_subtitle !== undefined) updateData.hero_subtitle = hero_subtitle;
    if (section_title !== undefined) updateData.section_title = section_title;
    if (usage_guide !== undefined || home_carousel !== undefined) {
      const { data } = await supabase
        .from('site_settings')
        .select('usage_guide')
        .eq('id', 'main')
        .single();

      const currentUsageGuide = data?.usage_guide || '';
      const visibleUsageGuide = usage_guide === undefined
        ? stripHiddenSiteConfig(currentUsageGuide)
        : String(usage_guide);
      const mergedUsageGuide = withExistingSortConfig(visibleUsageGuide, currentUsageGuide);
      updateData.usage_guide = home_carousel === undefined
        ? mergedUsageGuide
        : withHomeCarousel(mergedUsageGuide, home_carousel);
    }

    const { error } = await supabase
      .from('site_settings')
      .update(updateData)
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
