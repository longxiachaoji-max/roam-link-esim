
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Initialize with service role key for admin-like access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
  }

  try {
    // First, find the customer_id from the email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (customerError || !customer) {
      // If customer not found, return empty history, not an error
      return NextResponse.json([]);
    }

    // Then, fetch transactions for that customer_id
    const { data: transactions, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching member token transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch token transactions' }, { status: 500 });
    }

    return NextResponse.json(transactions || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
