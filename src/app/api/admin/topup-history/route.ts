
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Initialize with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RECEIVED_AMOUNT_PATTERN = /\[收款金額:\d+(?:\.\d+)?\]\s*/;

function withReceivedAmount(reason: string | null, receivedAmount: number) {
  const cleanReason = (reason || '').replace(RECEIVED_AMOUNT_PATTERN, '').trim();
  return `[收款金額:${receivedAmount}]${cleanReason ? ` ${cleanReason}` : ''}`;
}

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

export async function PATCH(request: Request) {
  try {
    const { id, receivedAmount } = await request.json();
    const numericReceivedAmount = Number(receivedAmount);

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 });
    }

    if (!Number.isFinite(numericReceivedAmount) || numericReceivedAmount < 0) {
      return NextResponse.json({ error: 'Invalid received amount' }, { status: 400 });
    }

    const { data: transaction, error: fetchError } = await supabase
      .from('token_transactions')
      .select('id, reason')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json({ error: fetchError?.message || 'Transaction not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('token_transactions')
      .update({ reason: withReceivedAmount(transaction.reason, numericReceivedAmount) })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
