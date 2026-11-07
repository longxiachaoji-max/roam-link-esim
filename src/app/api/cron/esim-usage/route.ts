import { after, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshAllActiveUsage } from '@/lib/esim-usage-snapshots';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MIN_INTERVAL_MS = 20 * 60_000;

// 每 30 分鐘由 Supabase pg_cron 呼叫一次（Vercel Hobby 的 cron 一天只能跑一次）。
// 有設定 USAGE_CRON_SECRET 時必須帶 Bearer；沒設定時不需密鑰，但 20 分鐘內只會真的執行一次，
// 所以就算被別人呼叫也不會比排程多查 Micro。
export async function GET(request: Request) {
  const secret = process.env.USAGE_CRON_SECRET || '';
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const { data: last } = await supabase
    .from('esim_usage_snapshots')
    .select('checked_at')
    .eq('source', 'cron')
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.checked_at && Date.now() - new Date(last.checked_at).getTime() < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: 'ran recently' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // 先回應，背景更新（呼叫端不用等）
  after(async () => {
    try {
      const result = await refreshAllActiveUsage(supabase);
      console.log('eSIM usage cron:', JSON.stringify(result));
    } catch (error) {
      console.error('eSIM usage cron failed:', error);
    }
  });
  return NextResponse.json({ ok: true, started: true }, { headers: { 'Cache-Control': 'no-store' } });
}
