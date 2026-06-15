import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Supabase client with Service Role Key for backend operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to send Telegram notification:', text);
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

    // 3. Find available eSIM inventory. If none exists, still allow checkout and
    // leave the order item pending for manual fulfillment in admin/orders.
    const { data: inventory, error: inventoryError } = await supabase
      .from('e_sim_inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'AVAILABLE')
      .limit(1)
      .single();

    const assignedInventory = inventoryError ? null : inventory;

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
        order_status: assignedInventory && totalAmount === 0 ? 'COMPLETED' : 'PENDING'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 6. Bind inventory when available. Otherwise the member page will show 處理中.
    if (assignedInventory) {
      const { error: updateInventoryError } = await supabase
        .from('e_sim_inventory')
        .update({
          status: 'SOLD',
          sold_at: new Date().toISOString()
        })
        .eq('id', assignedInventory.id)
        .eq('status', 'AVAILABLE'); // Optimistic locking

      if (updateInventoryError) throw updateInventoryError;
    }

    // Create order item
    const { error: orderItemError } = await supabase
      .from('order_items')
      .insert([{
        order_id: order.id,
        product_id: product.id,
        inventory_id: assignedInventory ? assignedInventory.id : null,
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
          transaction_type: 'purchase',
          balance_after: newBalance,
          reason: `購買 eSIM (訂單 #${order.id.split('-')[0]})`
        }]);
      if (txError) console.error("Failed to insert token_transaction:", txError);
    }

    // 7. Send email via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://roma-link-esim.vercel.app'}/admin/orders`;
    try {
      await resend.emails.send({
        from: `Roam Link eSIM <${fromEmail}>`,
        to: [email],
        subject: assignedInventory ? `Your eSIM for ${product.name} is ready!` : `Your ${product.name} order is being prepared`,
        html: assignedInventory ? `
          <h1>Thank you for your purchase!</h1>
          <p>Here are your eSIM details for <strong>${product.name}</strong>.</p>
          <p><strong>SM-DP+ Address:</strong> ${assignedInventory.smdp_address}</p>
          <p><strong>Activation Code:</strong> ${assignedInventory.activation_code}</p>
          <p>Or scan the QR code (generated from the LPA string) on your device.</p>
          <p>Enjoy your trip to ${product.country}!</p>
        ` : `
          <h1>Thank you for your purchase!</h1>
          <p>Your order for <strong>${product.name}</strong> has been received and is being prepared.</p>
          <p>You can check your member center later. The installation button and QR Code will appear once the eSIM is assigned.</p>
        `,
      });

      const notifyEmail = process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
      if (!assignedInventory && notifyEmail) {
        await resend.emails.send({
          from: `Roam Link eSIM <${fromEmail}>`,
          to: [notifyEmail],
          subject: `待補 eSIM 訂單：${product.name}`,
          html: `
            <h1>有一筆訂單需要補 eSIM</h1>
            <p><strong>訂單：</strong>${order.id}</p>
            <p><strong>客戶：</strong>${email}</p>
            <p><strong>商品：</strong>${product.name}</p>
            <p><strong>金額：</strong>NT$${Number(product.price)}</p>
            <p>請到後台訂單管理補上 eSIM 資料。</p>
          `,
        });
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // We don't throw here, order is still successful, but email failed.
    }

    if (!assignedInventory) {
      await sendTelegramNotification([
        '<b>有一筆訂單需要補 eSIM</b>',
        `訂單：<code>${escapeTelegramHtml(order.id)}</code>`,
        `客戶：${escapeTelegramHtml(email)}`,
        `商品：${escapeTelegramHtml(product.name)}`,
        `國家：${escapeTelegramHtml(product.country || '-')}`,
        `天數：${product.validity_days || '-'} 天`,
        `金額：NT$${Number(product.price)}`,
        `後台：${adminUrl}`
      ].join('\n'));
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      inventoryStatus: assignedInventory ? 'ASSIGNED' : 'PENDING',
      message: assignedInventory ? 'Checkout successful, eSIM provisioned.' : 'Checkout successful, eSIM pending fulfillment.',
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
