import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('資料庫服務尚未設定');
  return createClient(url, serviceKey);
}

export async function markEcpayTopupPaid(orderId: string, tradeAmount: number) {
  const supabase = getAdminClient();
  const normalizedAmount = Math.round(tradeAmount);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id, total_amount, payment_method, payment_status, tokens_used')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('找不到儲值訂單');
  if (order.payment_method !== 'ECPAY_TOPUP') throw new Error('付款方式與儲值訂單不符');
  if (Math.round(Number(order.total_amount)) !== normalizedAmount) throw new Error('綠界付款金額與儲值訂單不符');
  if (order.payment_status === 'PAID') return { credited: true, alreadyProcessed: true };

  const { data: claimed, error: claimError } = await supabase
    .from('orders')
    .update({ payment_status: 'PROCESSING', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'PENDING')
    .select('id');
  if (claimError) throw claimError;
  if (!claimed?.length) return { credited: false, alreadyProcessed: true };

  let previousBalance = 0;
  let newBalance = 0;
  let balanceUpdated = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('token_balance')
      .eq('id', order.customer_id)
      .single();
    if (customerError || !customer) throw customerError || new Error('找不到儲值會員');

    previousBalance = Number(customer.token_balance || 0);
    newBalance = previousBalance + normalizedAmount;
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', order.customer_id)
      .eq('token_balance', previousBalance)
      .select('id');
    if (updateError) throw updateError;
    if (updatedCustomer?.length) {
      balanceUpdated = true;
      break;
    }
  }

  if (!balanceUpdated) {
    await supabase.from('orders').update({ payment_status: 'PENDING', tokens_used: 0 }).eq('id', orderId).eq('payment_status', 'PROCESSING');
    throw new Error('會員餘額更新忙碌，請稍後重試');
  }

  const { data: transaction, error: transactionError } = await supabase
    .from('token_transactions')
    .insert([{
      customer_id: order.customer_id,
      amount: normalizedAmount,
      transaction_type: 'topup',
      balance_after: newBalance,
      reason: `[收款金額:${normalizedAmount}] 拾機綠界信用卡儲值 訂單:${order.id}`
    }])
    .select('id')
    .single();

  if (transactionError || !transaction) {
    await supabase.from('customers').update({ token_balance: previousBalance }).eq('id', order.customer_id).eq('token_balance', newBalance);
    await supabase.from('orders').update({ payment_status: 'PENDING', tokens_used: 0 }).eq('id', orderId).eq('payment_status', 'PROCESSING');
    throw transactionError || new Error('儲值紀錄建立失敗');
  }

  const { error: paidError } = await supabase
    .from('orders')
    .update({ payment_status: 'PAID', order_status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'PROCESSING');

  if (paidError) {
    await supabase.from('token_transactions').delete().eq('id', transaction.id);
    await supabase.from('customers').update({ token_balance: previousBalance }).eq('id', order.customer_id).eq('token_balance', newBalance);
    await supabase.from('orders').update({ payment_status: 'PENDING', tokens_used: 0 }).eq('id', orderId).eq('payment_status', 'PROCESSING');
    throw paidError;
  }

  return { credited: true, alreadyProcessed: false, newBalance };
}
