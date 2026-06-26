import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { awardReferralRewards } from '@/lib/referrals';
import { createMicroesimTestInventory, isMicroesimTestProduct } from '@/lib/microesim';

const NOTIFICATION_CONFIG_PATTERN = /\n?<!--NOTIFICATION_SETTINGS:([\s\S]*?)-->\n?/;

interface ProductSummary {
  id?: string;
  name?: string | null;
  country?: string | null;
  validity_days?: number | null;
}

interface FulfillmentItem {
  id: string;
  product_id?: string | null;
  inventory_id: string | null;
  products?: ProductSummary | null;
}

interface PaidOrder {
  id: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  customers: { email?: string | null; name?: string | null } | null;
  order_items: FulfillmentItem[];
}

interface NotificationSettings {
  notify_email_enabled: boolean;
  order_notify_email: string;
  notify_telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key);
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function getNotificationSettings(supabase: ReturnType<typeof getAdminClient>) {
  const fallback = {
    notify_email_enabled: Boolean(process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL),
    order_notify_email: process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || '',
    notify_telegram_enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || ''
  };
  const { data } = await supabase.from('site_settings').select('usage_guide').eq('id', 'main').single();
  const match = (data?.usage_guide || '').match(NOTIFICATION_CONFIG_PATTERN);
  if (!match?.[1]) return fallback;

  try {
    const config = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as Partial<NotificationSettings>;
    return {
      notify_email_enabled: config.notify_email_enabled ?? fallback.notify_email_enabled,
      order_notify_email: config.order_notify_email || fallback.order_notify_email,
      notify_telegram_enabled: config.notify_telegram_enabled ?? fallback.notify_telegram_enabled,
      telegram_bot_token: config.telegram_bot_token || fallback.telegram_bot_token,
      telegram_chat_id: config.telegram_chat_id || fallback.telegram_chat_id
    };
  } catch {
    return fallback;
  }
}

async function sendPaidOrderNotifications(order: PaidOrder, pendingItems: FulfillmentItem[]) {
  const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const customerEmail = order.customers?.email || '';
  const productNames = order.order_items.map(item => item.products?.name || 'eSIM 商品').join('、');
  const memberUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://roma-link-esim.vercel.app'}/member`;
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://roma-link-esim.vercel.app'}/admin/orders`;

  if (customerEmail) {
    try {
      await resend.emails.send({
        from: `Roam Link eSIM <${fromEmail}>`,
        to: [customerEmail],
        subject: pendingItems.length ? '付款成功，eSIM 正在準備中' : '付款成功，eSIM 已可安裝',
        html: `
          <h1>付款成功</h1>
          <p>訂單商品：<strong>${productNames}</strong></p>
          <p>${pendingItems.length ? '部分或全部 eSIM 正在準備中，配發後會員中心會自動出現安裝按鈕。' : '你的 eSIM 已經配發完成，可前往會員中心安裝。'}</p>
          <p><a href="${memberUrl}">前往會員中心</a></p>
        `
      });
    } catch (error) {
      console.error('Failed to send ECPay customer email:', error);
    }
  }

  if (!pendingItems.length) return;
  const supabase = getAdminClient();
  const settings = await getNotificationSettings(supabase);
  const pendingNames = pendingItems.map(item => item.products?.name || 'eSIM 商品').join('、');

  if (settings.notify_email_enabled && settings.order_notify_email) {
    try {
      await resend.emails.send({
        from: `Roam Link eSIM <${fromEmail}>`,
        to: [settings.order_notify_email],
        subject: `待補 eSIM 訂單：${pendingNames}`,
        html: `<h1>綠界付款成功，訂單需要補 eSIM</h1><p>訂單：${order.id}</p><p>客戶：${customerEmail}</p><p>商品：${pendingNames}</p><p><a href="${adminUrl}">前往訂單管理</a></p>`
      });
    } catch (error) {
      console.error('Failed to send ECPay admin email:', error);
    }
  }

  if (settings.notify_telegram_enabled && settings.telegram_bot_token && settings.telegram_chat_id) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegram_chat_id,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          text: [
            '<b>綠界付款成功，訂單需要補 eSIM</b>',
            `訂單：<code>${escapeTelegramHtml(order.id)}</code>`,
            `客戶：${escapeTelegramHtml(customerEmail)}`,
            `商品：${escapeTelegramHtml(pendingNames)}`,
            `後台：${adminUrl}`
          ].join('\n')
        })
      });
      if (!response.ok) console.error('Failed to send ECPay Telegram notification:', await response.text());
    } catch (error) {
      console.error('Failed to send ECPay Telegram notification:', error);
    }
  }
}

async function fulfillMicroesimTestItem(
  supabase: ReturnType<typeof getAdminClient>,
  item: FulfillmentItem
) {
  if (!item.product_id || !isMicroesimTestProduct(item.products?.name)) return false;

  const esim = await createMicroesimTestInventory();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { data: inventory, error: inventoryError } = await supabase
    .from('e_sim_inventory')
    .insert({
      product_id: item.product_id,
      iccid: esim.iccid,
      smdp_address: esim.smdp_address,
      activation_code: esim.activation_code,
      status: 'SOLD',
      sold_at: new Date().toISOString(),
      expiry_date: expiresAt.toISOString(),
      cost: esim.cost
    })
    .select('id')
    .single();
  if (inventoryError || !inventory) throw inventoryError || new Error('新增 MicroEsim 測試庫存失敗');

  const { data: updatedItems, error: itemUpdateError } = await supabase
    .from('order_items')
    .update({ inventory_id: inventory.id })
    .eq('id', item.id)
    .is('inventory_id', null)
    .select('id');

  if (itemUpdateError || !updatedItems?.length) {
    await supabase.from('e_sim_inventory').delete().eq('id', inventory.id);
    if (itemUpdateError) throw itemUpdateError;
    return false;
  }

  return true;
}

export async function markEcpayOrderPaidAndFulfill(orderId: string, tradeAmount: number) {
  const supabase = getAdminClient();
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, total_amount, payment_method, payment_status, order_status,
      customers ( email, name ),
      order_items (
        id, product_id, inventory_id,
        products ( id, name, country, validity_days )
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !orderData) throw new Error('找不到綠界付款對應的訂單');
  const order = orderData as unknown as PaidOrder;
  if (order.payment_method !== 'ECPAY') throw new Error('付款方式與訂單不符');
  if (Math.round(Number(order.total_amount)) !== Math.round(tradeAmount)) throw new Error('綠界付款金額與訂單不符');
  if (order.payment_status === 'PAID') return { alreadyProcessed: true, order };

  const { data: claimedOrders, error: paidError } = await supabase
    .from('orders')
    .update({ payment_status: 'PAID', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'PENDING')
    .select('id');

  if (paidError) throw paidError;
  if (!claimedOrders?.length) return { alreadyProcessed: true, order };

  for (const item of order.order_items || []) {
    if (item.inventory_id || !item.product_id) continue;

    const { data: candidates } = await supabase
      .from('e_sim_inventory')
      .select('id')
      .eq('product_id', item.product_id)
      .eq('status', 'AVAILABLE')
      .limit(5);

    for (const candidate of candidates || []) {
      const { data: claimedInventory } = await supabase
        .from('e_sim_inventory')
        .update({ status: 'SOLD', sold_at: new Date().toISOString() })
        .eq('id', candidate.id)
        .eq('status', 'AVAILABLE')
        .select('id');

      if (!claimedInventory?.length) continue;
      const { data: updatedItems, error: itemUpdateError } = await supabase
        .from('order_items')
        .update({ inventory_id: candidate.id })
        .eq('id', item.id)
        .is('inventory_id', null)
        .select('id');

      if (itemUpdateError || !updatedItems?.length) {
        await supabase.from('e_sim_inventory').update({ status: 'AVAILABLE', sold_at: null }).eq('id', candidate.id);
        if (itemUpdateError) throw itemUpdateError;
        continue;
      }
      break;
    }

    const { data: currentItem } = await supabase
      .from('order_items')
      .select('id, inventory_id')
      .eq('id', item.id)
      .single();
    if (!currentItem?.inventory_id) {
      try {
        await fulfillMicroesimTestItem(supabase, item);
      } catch (error) {
        console.error('MicroEsim test fulfillment failed:', error);
      }
    }
  }

  const { data: refreshedItems, error: refreshError } = await supabase
    .from('order_items')
    .select('id, inventory_id, products ( name )')
    .eq('order_id', orderId);
  if (refreshError) throw refreshError;

  const normalizedItems: FulfillmentItem[] = (refreshedItems || []).map(item => ({
    id: item.id,
    inventory_id: item.inventory_id,
    products: Array.isArray(item.products) ? (item.products[0] || null) : item.products
  }));
  const pendingItems = normalizedItems.filter(item => !item.inventory_id);
  await supabase
    .from('orders')
    .update({ order_status: pendingItems.length ? 'PENDING' : 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  await awardReferralRewards(supabase, orderId);

  const notificationOrder = { ...order, order_items: normalizedItems };
  await sendPaidOrderNotifications(notificationOrder, pendingItems);
  return { alreadyProcessed: false, order: notificationOrder, pendingItems };
}
