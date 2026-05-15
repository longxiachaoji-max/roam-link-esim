
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Initialize with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data: transactions, error } = await supabase
      .from('token_transactions')
      .select(`
        *,
        customers (
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching token transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch token transactions' }, { status: 500 });
    }

    return NextResponse.json(transactions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
