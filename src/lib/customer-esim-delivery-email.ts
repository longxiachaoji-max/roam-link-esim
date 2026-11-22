import 'server-only';

import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { groupProductNames } from '@/lib/product-summary';

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
    const productLines = groupProductNames(order.order_items.map(item => first(item.products)?.name));
    const totalCards = order.order_items.length;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
    const productRows = productLines.map(({ name, quantity }) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef0f3;font-size:15px;color:#1f2933;line-height:1.5;">${escapeHtml(name)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eef0f3;font-size:15px;color:#1f2933;text-align:right;white-space:nowrap;font-weight:700;">× ${quantity}</td>
      </tr>`).join('');
    const result = await resend.emails.send({
      from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
      to: [customerEmail],
      subject: `eSIM 已配發完成（共 ${totalCards} 張），可前往會員中心安裝`,
      html: `
<div style="margin:0;padding:24px 12px;background:#f3f5f8;font-family:-apple-system,BlinkMacSystemFont,'PingFang TC','Microsoft JhengHei',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#1a1a2e;padding:24px 28px;">
      <div style="font-size:13px;color:#f5bd61;font-weight:700;letter-spacing:1px;">一飛通全球漫遊 FirstRoamLink</div>
      <div style="margin-top:8px;font-size:24px;color:#ffffff;font-weight:800;">eSIM 已配發完成 ✅</div>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#52606d;">
        <tr><td style="padding:2px 0;">訂單編號</td><td style="padding:2px 0;text-align:right;color:#1f2933;font-weight:700;">${escapeHtml(order.order_number || order.id)}</td></tr>
        <tr><td style="padding:2px 0;">eSIM 數量</td><td style="padding:2px 0;text-align:right;color:#1f2933;font-weight:700;">共 ${totalCards} 張</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:8px 28px 0;">
      <div style="font-size:13px;color:#9aa5b1;font-weight:700;margin-bottom:4px;">購買方案</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${productRows}</table>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;text-align:center;">
      <a href="${siteUrl}/member" style="display:inline-block;background:#ff5a69;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 32px;border-radius:10px;">前往會員中心安裝 eSIM</a>
      <div style="margin-top:10px;font-size:13px;color:#9aa5b1;">安裝資料與 QR Code 都在會員中心</div>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;">
      <div style="background:#fff8ec;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;color:#7a5a1f;">
        <strong>安裝提醒</strong><br>
        ・請於啟用日前或旅程出發前完成安裝。<br>
        ・安裝時請連接穩定的 Wi-Fi 或行動網路，過程中請勿中斷。<br>
        ・每張 eSIM 的最晚安裝日與方案到期日，可在會員中心查看。
      </div>
    </td></tr>
  </table>
  <div style="max-width:560px;margin:12px auto 0;text-align:center;font-size:12px;color:#9aa5b1;">此信件由系統自動寄出，請勿直接回覆。</div>
</div>
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
