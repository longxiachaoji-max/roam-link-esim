import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AnalyticsEventType } from '@/lib/analytics';
import { parseTrafficAnalytics, withTrafficAnalytics } from '@/lib/traffic-analytics';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = new Set<AnalyticsEventType>([
  'topup_page_view',
  'roamlink_page_view',
  'topup_to_roamlink_click'
]);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('流量統計服務尚未設定');
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = String(body.eventType || '') as AnalyticsEventType;
    const visitorId = String(body.visitorId || '');
    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ error: '不支援的統計事件' }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
      return NextResponse.json({ error: '訪客識別碼格式錯誤' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error: readError } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();
    if (readError) throw readError;

    const currentGuide = data.usage_guide as string | null;
    const analytics = parseTrafficAnalytics(currentGuide);
    analytics.counters[eventType].total += 1;
    analytics.counters[eventType].today += 1;

    const { error: updateError } = await supabase
      .from('site_settings')
      .update({ usage_guide: withTrafficAnalytics(currentGuide, analytics) })
      .eq('id', 'main');
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics event error:', error);
    return NextResponse.json({ error: '無法記錄流量' }, { status: 500 });
  }
}
