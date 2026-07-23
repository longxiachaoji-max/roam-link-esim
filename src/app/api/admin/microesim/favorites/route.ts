import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const FAVORITES_PATTERN = /\n?<!--MICROESIM_FAVORITES:([\s\S]*?)-->\n?/;

function normalizePlanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ));
}

function parseFavorites(usageGuide: string | null) {
  const match = (usageGuide || '').match(FAVORITES_PATTERN);
  if (!match?.[1]) return [];

  try {
    const parsed = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    return normalizePlanIds(parsed.planIds);
  } catch {
    return [];
  }
}

function stripFavorites(usageGuide: string | null) {
  return (usageGuide || '').replace(FAVORITES_PATTERN, '').trim();
}

function withFavorites(usageGuide: string | null, planIds: string[]) {
  const cleanGuide = stripFavorites(usageGuide);
  const encoded = Buffer.from(JSON.stringify({
    planIds,
    updatedAt: new Date().toISOString()
  }), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--MICROESIM_FAVORITES:${encoded}-->`;
}

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ planIds: parseFavorites(data?.usage_guide || '') });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取我的最愛失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const planIds = normalizePlanIds(body.planIds);

    const { data, error: fetchError } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('site_settings')
      .update({
        usage_guide: withFavorites(data?.usage_guide || '', planIds),
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, planIds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '儲存我的最愛失敗' }, { status: 500 });
  }
}
