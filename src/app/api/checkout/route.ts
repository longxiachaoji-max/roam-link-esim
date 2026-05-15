import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Supabase client with Service Role Key for backend operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, productId, useTokens, paymentMethod } = body;

    if (!email || !productId) {
      return NextResponse.json({ error: 'Email and productId are required' }, { status: 400 });
    }

    // 1. Get or create customer
    let { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
    }

    if (!customer) {
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([{ email, name, token_balance: 0 }])
        .select()
        .single();
      
      if (createError) throw createError;
      customer = newCustomer;
    }

    // 2. Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 3. Find available eSIM inventory
    // In a real app, you might want to use an RPC or a transaction to avoid race conditions.
    const { data: inventory, error: inventoryError } = await supabase
      .from('e_sim_inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'AVAILABLE')
      .limit(1)
      .single();

    if (inventoryError || !inventory) {
      return NextResponse.json({ error: '庫存不足' }, { status: 400 });
    }

    // 4. Calculate total amount and token deduction
    let totalAmount = Number(product.price);
    let tokensUsed = 0;

    // Check for sufficient tokens if payment method is TOKENS
    if (paymentMethod === 'TOKENS') {
      if (!customer.token_balance || customer.token_balance < totalAmount) {
        return NextResponse.json({ error: '請儲值後結帳' }, { status: 400 });
      }
      tokensUsed = totalAmount;
      totalAmount = 0;
    } else if (useTokens && customer.token_balance > 0) {
      // Assuming 1 token = $1 discount
      if (customer.token_balance >= totalAmount) {
        tokensUsed = totalAmount;
        totalAmount = 0;
      } else {
        tokensUsed = customer.token_balance;
        totalAmount -= tokensUsed;
      }
    }

    // 5. Create Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: customer.id,
        total_amount: totalAmount,
        tokens_used: tokensUsed,
        payment_method: paymentMethod || 'CREDIT_CARD',
        payment_status: totalAmount === 0 ? 'PAID' : 'PENDING',
        order_status: 'CREATED'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 6. Bind Inventory to Order Item and Mark Inventory as SOLD
    // Update inventory first
    const { error: updateInventoryError } = await supabase
      .from('e_sim_inventory')
      .update({
        status: 'SOLD',
        sold_at: new Date().toISOString()
      })
      .eq('id', inventory.id)
      .eq('status', 'AVAILABLE'); // Optimistic locking

    if (updateInventoryError) throw updateInventoryError;

    // Create order item
    const { error: orderItemError } = await supabase
      .from('order_items')
      .insert([{
        order_id: order.id,
        product_id: product.id,
        inventory_id: inventory.id,
        price: product.price
      }]);

    if (orderItemError) throw orderItemError;

    // Deduct tokens from customer if used
    if (tokensUsed > 0) {
      const newBalance = customer.token_balance - tokensUsed;
      const { error: tokenError } = await supabase
        .from('customers')
        .update({ token_balance: newBalance })
        .eq('id', customer.id);
      
      if (tokenError) throw tokenError;

      // 新增：寫入扣款紀錄到 token_transactions
      const { error: txError } = await supabase
        .from('token_transactions')
        .insert([{
          customer_id: customer.id,
          amount: -tokensUsed,
          balance_after: newBalance,
          reason: `購買 eSIM (訂單 #${order.id.split('-')[0]})`
        }]);
      if (txError) console.error("Failed to insert token_transaction:", txError);
    }

    // 7. Send email via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    try {
      await resend.emails.send({
        from: `Roam Link eSIM <${fromEmail}>`,
        to: [email],
        subject: `Your eSIM for ${product.name} is ready!`,
        html: `
          <h1>Thank you for your purchase!</h1>
          <p>Here are your eSIM details for <strong>${product.name}</strong>.</p>
          <p><strong>SM-DP+ Address:</strong> ${inventory.smdp_address}</p>
          <p><strong>Activation Code:</strong> ${inventory.activation_code}</p>
          <p>Or scan the QR code (generated from the LPA string) on your device.</p>
          <p>Enjoy your trip to ${product.country}!</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // We don't throw here, order is still successful, but email failed.
    }

    // Optional: Mark order as COMPLETED if payment was skipped
    if (totalAmount === 0) {
      await supabase.from('orders').update({ order_status: 'COMPLETED' }).eq('id', order.id);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: 'Checkout successful, eSIM provisioned.',
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
