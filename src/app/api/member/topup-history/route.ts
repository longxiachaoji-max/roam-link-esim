
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';
import { toMemberTransactionReason } from '@/lib/member-transaction-reason';

export const dynamic = 'force-dynamic';

// Initialize with service role key for admin-like access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const email = user.email.toLowerCase();
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
      .select('id, customer_id, amount, transaction_type, balance_after, reason, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching member token transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch token transactions' }, { status: 500 });
    }

    // 後台備註與收款金額只留在後台，回給會員的只有系統說明
    return NextResponse.json((transactions || []).map(transaction => ({
      ...transaction,
      reason: toMemberTransactionReason(transaction.reason, Number(transaction.amount))
    })));
  } catch (e: any) {
    const authError = authenticationErrorResponse(e);
    if (authError) return authError;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
