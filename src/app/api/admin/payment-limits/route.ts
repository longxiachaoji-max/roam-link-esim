import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PAYMENT_LIMITS, normalizePaymentLimits, parsePaymentLimits, withPaymentLimits } from '@/lib/payment-limits';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error) return NextResponse.json({ limits: DEFAULT_PAYMENT_LIMITS });
    return NextResponse.json({ limits: parsePaymentLimits(data?.usage_guide) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const nextLimits = normalizePaymentLimits({
      credit_min: body.credit_min,
      credit_max: body.credit_max,
      barcode_min: body.barcode_min,
      barcode_max: body.barcode_max
    });

    const { data: current, error: readError } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('site_settings')
      .update({
        usage_guide: withPaymentLimits(current?.usage_guide || '', nextLimits),
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, limits: nextLimits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
