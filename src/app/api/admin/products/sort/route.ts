import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const SORT_CONFIG_PATTERN = /\n?<!--PRODUCT_SORT_CONFIG:([\s\S]*?)-->\n?/;

type SortConfig = {
  countries: string[];
  plans: string[];
};

const emptyConfig: SortConfig = {
  countries: [],
  plans: []
};

function parseSortConfig(usageGuide: string | null): SortConfig {
  const match = (usageGuide || '').match(SORT_CONFIG_PATTERN);
  if (!match?.[1]) return emptyConfig;

  try {
    const parsed = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    return {
      countries: Array.isArray(parsed.countries) ? parsed.countries.filter(Boolean) : [],
      plans: Array.isArray(parsed.plans) ? parsed.plans.filter(Boolean) : []
    };
  } catch {
    return emptyConfig;
  }
}

function stripSortConfig(usageGuide: string | null) {
  return (usageGuide || '').replace(SORT_CONFIG_PATTERN, '').trim();
}

function withSortConfig(usageGuide: string | null, config: SortConfig) {
  const cleanGuide = stripSortConfig(usageGuide);
  const encoded = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--PRODUCT_SORT_CONFIG:${encoded}-->`;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sort: parseSortConfig(data?.usage_guide) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取排序設定失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const sort: SortConfig = {
      countries: Array.isArray(body.countries) ? body.countries.map((item: string) => item.trim()).filter(Boolean) : [],
      plans: Array.isArray(body.plans) ? body.plans.map((item: string) => item.trim()).filter(Boolean) : []
    };

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
        usage_guide: withSortConfig(data?.usage_guide, sort),
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sort });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '儲存排序設定失敗' }, { status: 500 });
  }
}
