import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseTrafficAnalytics } from '@/lib/traffic-analytics';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('流量統計服務尚未設定');
  return createClient(url, serviceKey);
}

export async function GET() {
  try {
    const { data, error } = await getAdminClient()
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();
    if (error) throw error;
    const counters = parseTrafficAnalytics(data.usage_guide).counters;

    return NextResponse.json({
      metrics: {
        topupPageViews: counters.topup_page_view,
        roamlinkPageViews: counters.roamlink_page_view,
        topupToRoamlinkClicks: counters.topup_to_roamlink_click
      },
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ error: '無法載入流量統計' }, { status: 500 });
  }
}
