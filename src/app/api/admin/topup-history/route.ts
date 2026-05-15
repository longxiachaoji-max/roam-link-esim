import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('token_transactions')
      .select(`
        id,
        amount,
        balance_after,
        reason,
        created_at,
        customers (
          email,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
