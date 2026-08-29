import 'server-only';

import QRCode from 'qrcode';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export async function sendDealerEsimDeliveryEmail(supabase: SupabaseClient, orderItemId: string) {
  const { data: dealerItem, error: dealerItemError } = await supabase
    .from('dealer_order_items')
    .select('id, dealer_order_id, delivery_email_status')
    .eq('order_item_id', orderItemId)
    .maybeSingle();
  if (dealerItemError) throw dealerItemError;
  if (!dealerItem || dealerItem.delivery_email_status === 'sent' || dealerItem.delivery_email_status === 'sending') {
    return false;
  }

  const { data: claimed, error: claimError } = await supabase
    .from('dealer_order_items')
    .update({ delivery_email_status: 'sending', delivery_email_error: null })
    .eq('id', dealerItem.id)
    .in('delivery_email_status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return false;

  try {
    const [{ data: dealerOrder, error: dealerOrderError }, { data: item, error: itemError }] = await Promise.all([
      supabase
        .from('dealer_orders')
        .select('customer_email, customer_name, fulfillment_order_id, orders ( order_number )')
        .eq('id', dealerItem.dealer_order_id)
        .single(),
      supabase
        .from('order_items')
        .select(`
          id,
          products ( name, country, validity_days ),
          e_sim_inventory ( iccid, smdp_address, activation_code )
        `)
        .eq('id', orderItemId)
        .single()
    ]);
    if (dealerOrderError) throw dealerOrderError;
    if (itemError) throw itemError;

    const inventory = first(item.e_sim_inventory as Record<string, unknown> | Record<string, unknown>[] | null);
    const product = first(item.products as Record<string, unknown> | Record<string, unknown>[] | null);
    const order = first(dealerOrder.orders as Record<string, unknown> | Record<string, unknown>[] | null);
    const smdpAddress = String(inventory?.smdp_address || '').trim();
    const activationCode = String(inventory?.activation_code || '').trim();
    if (!smdpAddress || !activationCode) throw new Error('eSIM 安裝資料尚未完整');

    const lpa = `LPA:1$${smdpAddress}$${activationCode}`;
    const oneClickUrl = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
    const qrBuffer = await QRCode.toBuffer(lpa, { type: 'png', width: 520, margin: 2, errorCorrectionLevel: 'M' });
    const memberUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space'}/member`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
    const result = await resend.emails.send({
      from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
      to: [dealerOrder.customer_email],
      subject: `eSIM 已可安裝：${String(product?.name || '一飛通 eSIM')}`,
      attachments: [{
        filename: 'FirstRoamLink-eSIM-QR.png',
        content: qrBuffer,
        contentType: 'image/png',
        contentId: 'firstroamlink-esim-qr'
      }],
      html: `
        <div style="font-family:Arial,'Noto Sans TC',sans-serif;max-width:620px;margin:auto;color:#171725;line-height:1.7">
          <h1 style="font-size:24px">你的 eSIM 已準備完成</h1>
          <p>${escapeHtml(dealerOrder.customer_name || '您好')}，感謝使用一飛通全球漫遊。</p>
          <p>商品：<strong>${escapeHtml(product?.name || 'eSIM 方案')}</strong><br>訂單：${escapeHtml(order?.order_number || dealerOrder.fulfillment_order_id)}</p>
          <p style="text-align:center"><img src="cid:firstroamlink-esim-qr" width="280" height="280" alt="eSIM 安裝 QR Code" style="max-width:100%;height:auto"></p>
          <p style="text-align:center"><a href="${oneClickUrl}" style="display:inline-block;background:#ff4f73;color:white;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:700">iPhone 一鍵安裝 eSIM</a></p>
          <p><strong>安裝提醒：</strong>請於啟用日前或旅程出發前完成安裝，並先連接穩定的 Wi-Fi 或行動網路。請勿使用同一支手機掃描畫面中的 QR Code，可改用一鍵安裝或另一台裝置顯示 QR Code。</p>
          <p>已有一飛通帳號的客戶，也可到 <a href="${memberUrl}">會員中心</a> 查看本次購買與安裝資料。</p>
        </div>
      `
    });
    if (result.error) throw new Error(result.error.message);

    await supabase
      .from('dealer_order_items')
      .update({
        delivery_email_status: 'sent',
        delivery_email_sent_at: new Date().toISOString(),
        delivery_email_error: null
      })
      .eq('id', dealerItem.id);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '寄送失敗';
    await supabase
      .from('dealer_order_items')
      .update({ delivery_email_status: 'failed', delivery_email_error: message.slice(0, 500) })
      .eq('id', dealerItem.id);
    throw error;
  }
}
