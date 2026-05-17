import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET - 取得所有訂單
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        tokens_used,
        payment_method,
        payment_status,
        order_status,
        customers (
          email,
          name
        ),
        order_items (
          id,
          price,
          note,
          user_deleted_at,
          products (
            name,
            country,
            data_amount,
            validity_days
          ),
          e_sim_inventory (
            iccid,
            smdp_address,
            activation_code,
            status
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
