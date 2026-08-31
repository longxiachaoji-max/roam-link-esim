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
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
    const memberUrl = `${siteUrl}/member`;
    const supportUrl = 'https://lin.ee/Td0EgHE';
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
        <div style="margin:0;padding:28px 12px;background:#f4f5f8;font-family:Arial,'Noto Sans TC',sans-serif;color:#171725;line-height:1.7">
          <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #e8e8ee;border-radius:16px;background:#ffffff">
            <div style="padding:30px 24px;text-align:center;background:#101020;color:#ffffff">
              <p style="margin:0 0 8px;font-size:14px;letter-spacing:1px;color:#55d5ea">一飛通全球漫遊 FirstRoamLink</p>
              <h1 style="margin:0;font-size:26px;line-height:1.35">感謝您的訂購！</h1>
              <p style="margin:10px 0 0;color:#d7d7e2">您的 eSIM 已準備完成</p>
            </div>

            <div style="padding:26px 24px">
              <p style="margin:0 0 18px">${escapeHtml(dealerOrder.customer_name || '您好')}，感謝您選擇一飛通全球漫遊，以下是本次訂購的 eSIM 安裝資料。</p>
              <div style="padding:16px;border-radius:10px;background:#f7f7fa">
                <p style="margin:0 0 5px"><strong>商品：</strong>${escapeHtml(product?.name || 'eSIM 方案')}</p>
                <p style="margin:0"><strong>訂單：</strong>${escapeHtml(order?.order_number || dealerOrder.fulfillment_order_id)}</p>
              </div>

              <div style="padding:26px 0 10px;text-align:center">
                <h2 style="margin:0 0 6px;font-size:20px">eSIM 安裝 QR Code</h2>
                <p style="margin:0 0 16px;font-size:13px;color:#6d6d78">請使用要安裝 eSIM 的手機掃描，或點選下方一鍵安裝</p>
                <img src="cid:firstroamlink-esim-qr" width="280" height="280" alt="eSIM 安裝 QR Code" style="display:block;max-width:100%;height:auto;margin:0 auto;border:1px solid #eeeeF2;border-radius:12px">
                <p style="margin:20px 0 0"><a href="${oneClickUrl}" style="display:inline-block;padding:13px 22px;border-radius:7px;background:#ff4f73;color:#ffffff;text-decoration:none;font-weight:700">iPhone 一鍵安裝 eSIM</a></p>
              </div>

              <div style="margin-top:18px;padding:16px;border-left:4px solid #55d5ea;background:#f1fbfd">
                <p style="margin:0"><strong>安裝提醒：</strong>請於啟用日前或旅程出發前完成安裝，並先連接穩定的 Wi-Fi 或行動網路。請勿使用同一支手機掃描自己畫面中的 QR Code，可改用一鍵安裝或另一台裝置顯示 QR Code。</p>
              </div>

              <p style="margin:20px 0 0">已有一飛通帳號的客戶，也可前往 <a href="${memberUrl}" style="color:#147d91;font-weight:700">會員中心</a> 查看訂單與安裝資料。</p>

              <div style="margin-top:26px;padding-top:22px;border-top:1px solid #ececf1;text-align:center">
                <a href="${siteUrl}" style="display:inline-block;margin:4px;padding:11px 18px;border:1px solid #101020;border-radius:7px;color:#101020;text-decoration:none;font-weight:700">前往一飛通官網</a>
                <a href="${supportUrl}" style="display:inline-block;margin:4px;padding:11px 18px;border-radius:7px;background:#06c755;color:#ffffff;text-decoration:none;font-weight:700">聯繫 LINE 客服</a>
                <p style="margin:16px 0 0;font-size:12px;color:#898994">官網：<a href="${siteUrl}" style="color:#666674">${siteUrl}</a><br>如需訂單或安裝協助，歡迎透過 LINE 聯繫客服。</p>
              </div>
            </div>
          </div>
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
