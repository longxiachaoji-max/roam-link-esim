import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { customerId, amount, reason } = await request.json();

    if (!customerId || amount === undefined || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch current balance
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('token_balance')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const newBalance = Math.max(0, customer.token_balance + amount);

    // 2. Update balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('id', customerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Record transaction
    const { error: txError } = await supabase
      .from('token_transactions')
      .insert([{
        customer_id: customerId,
        amount: amount,
        balance_after: newBalance,
        reason: reason
      }]);

    if (txError) {
      console.error('Failed to record transaction:', txError);
      // Rollback the balance update to maintain data integrity
      await supabase
        .from('customers')
        .update({ token_balance: customer.token_balance }) // Revert to the old balance
        .eq('id', customerId);
        
      return NextResponse.json({ error: `Transaction record failed: ${txError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
