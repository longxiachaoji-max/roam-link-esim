import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    // 1. Get customer
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ orders: [] }); // User might not have any orders yet
    }

    // 2. Get orders and join items, products, inventory
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, 
        created_at, 
        total_amount, 
        payment_status,
        order_status,
        order_items (
          id, 
          price,
          note,
          user_deleted_at,
          products ( id, name, country, data_amount, validity_days ),
          e_sim_inventory ( id, iccid, smdp_address, activation_code, status )
        )
      `)
      .eq('customer_id', customer.id)
      .eq('payment_status', 'PAID')
      .neq('payment_method', 'ECPAY_TOPUP')
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
