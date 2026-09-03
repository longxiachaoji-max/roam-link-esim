import 'server-only';

import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

type Relation<T> = T | T[] | null;

interface DeliveryOrder {
  id: string;
  order_number: string | null;
  payment_status: string;
  order_status: string;
  esim_delivery_email_status: string;
  customers: Relation<{ email: string | null }>;
  order_items: Array<{
    inventory_id: string | null;
    products: Relation<{ name: string | null }>;
  }>;
}

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendCustomerEsimDeliveryEmail(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, payment_status, order_status, esim_delivery_email_status,
      customers ( email ),
      order_items ( inventory_id, products ( name ) )
    `)
    .eq('id', orderId)
    .single();
  if (error) throw error;

  const order = data as unknown as DeliveryOrder;
  if (
    order.payment_status !== 'PAID'
    || order.order_status !== 'COMPLETED'
    || !order.order_items?.length
    || order.order_items.some(item => !item.inventory_id)
    || ['sending', 'sent'].includes(order.esim_delivery_email_status)
  ) {
    return false;
  }

  // Dealer customers receive the dedicated email containing the QR code instead.
  const { data: dealerOrder, error: dealerError } = await supabase
    .from('dealer_orders')
    .select('id')
    .eq('fulfillment_order_id', orderId)
    .maybeSingle();
  if (dealerError) throw dealerError;
  if (dealerOrder) return false;

  const customerEmail = first(order.customers)?.email?.trim();
  if (!customerEmail) return false;

  const { data: claimed, error: claimError } = await supabase
    .from('orders')
    .update({ esim_delivery_email_status: 'sending', esim_delivery_email_error: null })
    .eq('id', orderId)
    .in('esim_delivery_email_status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return false;

  try {
    const productNames = order.order_items
      .map(item => first(item.products)?.name || 'eSIM 商品')
      .join('、');
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
    const result = await resend.emails.send({
      from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
      to: [customerEmail],
      subject: 'eSIM 已配發完成，可前往會員中心安裝',
      html: `
        <h1>eSIM 已配發完成</h1>
        <p>訂單：<strong>${escapeHtml(order.order_number || order.id)}</strong></p>
        <p>商品：<strong>${escapeHtml(productNames)}</strong></p>
        <p>安裝資料與 QR Code 已加入會員中心。</p>
        <p><strong>安裝提醒：</strong>請於啟用日前或旅程出發前完成安裝。安裝前請先連接穩定的 Wi-Fi 或行動網路，過程中請勿中斷連線。</p>
        <p>每張 eSIM 的最晚安裝日與啟用後方案到期日，可在會員中心分別查看。</p>
        <p><a href="${siteUrl}/member">前往會員中心安裝 eSIM</a></p>
      `
    });
    if (result.error) throw new Error(result.error.message);

    await supabase
      .from('orders')
      .update({
        esim_delivery_email_status: 'sent',
        esim_delivery_email_sent_at: new Date().toISOString(),
        esim_delivery_email_error: null
      })
      .eq('id', orderId);
    return true;
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : '寄送失敗';
    await supabase
      .from('orders')
      .update({ esim_delivery_email_status: 'failed', esim_delivery_email_error: message.slice(0, 500) })
      .eq('id', orderId);
    throw sendError;
  }
}
