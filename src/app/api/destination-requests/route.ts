import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { escapeTelegramHtml, getTelegramNotificationSettings, sendTelegramMessage } from '@/lib/order-alerts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('目的地需求服務尚未設定');
  return createClient(url, key);
}

function normalizeCountry(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const country = normalizeCountry(body?.country);
    const visitorId = String(body?.visitorId || '').trim();
    const honeypot = String(body?.website || '').trim();

    if (honeypot) return NextResponse.json({ success: true });
    if (!UUID_PATTERN.test(visitorId) || country.length < 2) {
      return NextResponse.json({ error: '請輸入至少 2 個字的國家或地區名稱' }, { status: 400 });
    }
    if (/https?:\/\/|[<>]/i.test(country)) {
      return NextResponse.json({ error: '國家或地區名稱格式不正確' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('destination_requests')
      .select('id', { count: 'exact', head: true })
      .eq('visitor_id', visitorId)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count || 0) >= 5) {
      return NextResponse.json({ error: '今天已收到多筆需求，謝謝你的建議' }, { status: 429 });
    }

    const countryKey = country.toLocaleLowerCase('zh-TW');
    const { data, error } = await supabase
      .from('destination_requests')
      .upsert({ country, country_key: countryKey, visitor_id: visitorId }, {
        onConflict: 'visitor_id,country_key',
        ignoreDuplicates: true
      })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    if (data) {
      const settings = await getTelegramNotificationSettings(supabase);
      await sendTelegramMessage(settings, [
        '<b>收到新的 eSIM 目的地需求</b>',
        `國家／地區：${escapeTelegramHtml(country)}`
      ], 'Failed to send destination request Telegram alert');
    }

    return NextResponse.json({ success: true, duplicate: !data });
  } catch (error) {
    console.error('Destination request error:', error);
    return NextResponse.json({ error: '需求暫時無法送出，請稍後再試' }, { status: 500 });
  }
}
