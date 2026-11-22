import 'server-only';

import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T> | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const MAX_LISTED_CARDS = 30;

// 擁有者把 eSIM 共享給別人時，寄信通知對方去 /app 登入查看
export async function sendEsimShareEmail(
  supabase: SupabaseClient,
  options: { ownerEmail: string; memberEmail: string; orderItemIds: string[] }
) {
  if (!options.orderItemIds.length) return false;
  const { data, error } = await supabase
    .from('order_items')
    .select('id, note, products ( name ), e_sim_inventory ( iccid )')
    .in('id', options.orderItemIds.slice(0, MAX_LISTED_CARDS));
  if (error) throw error;

  const rows = (data || []) as unknown as Array<{
    note: string | null;
    products: Relation<{ name: string | null }>;
    e_sim_inventory: Relation<{ iccid: string | null }>;
  }>;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const total = options.orderItemIds.length;
  const cardRows = rows.map(row => {
    const name = row.note?.trim() || first(row.products)?.name || 'eSIM';
    const plan = row.note?.trim() ? first(row.products)?.name || '' : '';
    const iccid = first(row.e_sim_inventory)?.iccid || '';
    return `
      <tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3;">
        <div style="font-size:15px;color:#1f2933;font-weight:700;">${escapeHtml(name)}</div>
        ${plan ? `<div style="font-size:13px;color:#52606d;">${escapeHtml(plan)}</div>` : ''}
        ${iccid ? `<div style="font-size:12px;color:#9aa5b1;">ICCID ${escapeHtml(iccid)}</div>` : ''}
      </td></tr>`;
  }).join('');
  const more = total > rows.length ? `<div style="padding-top:8px;font-size:13px;color:#9aa5b1;">…另外還有 ${total - rows.length} 張</div>` : '';

  const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
  const result = await resend.emails.send({
    from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
    to: [options.memberEmail],
    replyTo: options.ownerEmail,
    subject: `${options.ownerEmail} 與您共享了 ${total} 張 eSIM`,
    html: `
<div style="margin:0;padding:24px 12px;background:#f3f5f8;font-family:-apple-system,BlinkMacSystemFont,'PingFang TC','Microsoft JhengHei',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:24px 28px 8px;text-align:center;">
      <img src="${siteUrl}/brand/email-logo.jpg" width="180" alt="一飛通全球漫遊 FirstRoamLink" style="display:inline-block;width:180px;max-width:60%;height:auto;border:0;">
    </td></tr>
    <tr><td style="padding:8px 28px 4px;text-align:center;">
      <div style="font-size:22px;color:#1a1a2e;font-weight:800;">有人與您共享了 eSIM</div>
      <div style="margin-top:8px;font-size:14px;color:#52606d;"><strong>${escapeHtml(options.ownerEmail)}</strong> 共享了 ${total} 張 eSIM 給您</div>
    </td></tr>
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cardRows}</table>${more}
    </td></tr>
    <tr><td style="padding:24px 28px 8px;text-align:center;">
      <a href="${siteUrl}/app" style="display:inline-block;background:#ff5a69;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 32px;border-radius:10px;">查看共享的 eSIM</a>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;">
      <div style="background:#f0f9fb;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;color:#285866;">
        請用 <strong>${escapeHtml(options.memberEmail)}</strong> 登入（沒有帳號可直接註冊），卡片會出現在「共享給我」分頁。<br>
        您可以查看用量、掃描 QR Code 安裝，也可以自己建立分類整理。
      </div>
    </td></tr>
  </table>
  <div style="max-width:560px;margin:12px auto 0;text-align:center;font-size:12px;color:#9aa5b1;">此信件由系統自動寄出。如有疑問請直接回覆，信件會寄給共享者。</div>
</div>`
  });
  if (result.error) throw new Error(result.error.message);
  return true;
}
