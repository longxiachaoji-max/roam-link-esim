import {
  escapeTelegramHtml,
  getTelegramNotificationSettings,
  sendTelegramMessage,
  type SupabaseLike
} from '@/lib/order-alerts';

interface RentalOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_days: number | null;
}

interface RentalOrder {
  id: string;
  customer_email: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string | null;
  shipping_address: string;
  shipping_note: string | null;
  delivery_method: 'shipping' | 'pickup';
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  physical_order_items: RentalOrderItem[];
}

interface ReminderClaim {
  order_item_id: string;
  order_id: string;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return value.replace(/-/g, '/');
}

function paymentLabel(method: string) {
  if (method === 'TOKENS') return '儲值金';
  if (method === 'ECPAY_CREDIT') return '信用卡';
  return method;
}

function adminOrderUrl() {
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space'}/admin/physical-orders`;
}

function taipeiToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function loadRentalOrder(supabase: SupabaseLike, orderId: string): Promise<RentalOrder | null> {
  const { data, error } = await supabase
    .from('physical_orders')
    .select(`
      id, customer_email, recipient_name, recipient_phone, postal_code,
      shipping_address, shipping_note, delivery_method, shipping_fee, total_amount, payment_method,
      physical_order_items (
        id, product_name, quantity, rental_start_date, rental_end_date, rental_days
      )
    `)
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data as RentalOrder | null;
}

async function releaseOrderNotificationClaim(supabase: SupabaseLike, orderId: string) {
  await supabase.from('physical_orders').update({ rental_order_notified_at: null }).eq('id', orderId);
}

async function releaseReminderClaim(supabase: SupabaseLike, orderItemId: string) {
  await supabase.from('physical_order_items').update({ rental_start_reminder_sent_at: null }).eq('id', orderItemId);
}

export async function sendPhysicalRentalOrderCreatedAlert(supabase: SupabaseLike, orderId: string) {
  const settings = await getTelegramNotificationSettings(supabase);
  if (!settings.notify_telegram_enabled || !settings.telegram_bot_token || !settings.telegram_chat_id) return false;

  const { data: claimed, error: claimError } = await supabase.rpc('claim_physical_rental_order_notification', {
    p_order_id: orderId
  });
  if (claimError) {
    console.error('Failed to claim rental order Telegram alert:', claimError);
    return false;
  }
  if (!claimed) return false;

  try {
    const order = await loadRentalOrder(supabase, orderId);
    const rentalItems = order?.physical_order_items.filter(item => item.rental_start_date) || [];
    if (!order || !rentalItems.length) throw new Error('找不到租借訂單內容');

    const itemLines = rentalItems.map(item =>
      `商品：${escapeTelegramHtml(item.product_name)} × ${item.quantity}\n` +
      `期間：${formatDate(item.rental_start_date)} 至 ${formatDate(item.rental_end_date)}（${item.rental_days || '-'} 天）`
    );
    const sent = await sendTelegramMessage(settings, [
      '<b>新的手機租借訂單</b>',
      `訂單：<code>${escapeTelegramHtml(order.id)}</code>`,
      `客戶：${escapeTelegramHtml(order.customer_email)}`,
      `聯絡：${escapeTelegramHtml(order.recipient_name)} / ${escapeTelegramHtml(order.recipient_phone)}`,
      ...itemLines,
      `交付：${order.delivery_method === 'pickup' ? '預約面交' : `宅配（運費 NT$${Number(order.shipping_fee).toLocaleString('zh-TW')}）`}`,
      `金額：NT$${Number(order.total_amount).toLocaleString('zh-TW')}（${paymentLabel(order.payment_method)}已付款）`,
      `後台：${adminOrderUrl()}`
    ], 'Failed to send rental order Telegram alert');
    if (!sent) await releaseOrderNotificationClaim(supabase, orderId);
    return sent;
  } catch (error) {
    console.error('Failed to prepare rental order Telegram alert:', error);
    await releaseOrderNotificationClaim(supabase, orderId);
    return false;
  }
}

export async function sendDuePhysicalRentalReminders(supabase: SupabaseLike) {
  const settings = await getTelegramNotificationSettings(supabase);
  if (!settings.notify_telegram_enabled || !settings.telegram_bot_token || !settings.telegram_chat_id) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 'telegram_disabled' };
  }

  const { data, error } = await supabase.rpc('claim_due_physical_rental_reminders');
  if (error) throw error;
  const claims = (data || []) as ReminderClaim[];
  let sentCount = 0;
  let failedCount = 0;

  for (const claim of claims) {
    try {
      const order = await loadRentalOrder(supabase, claim.order_id);
      const item = order?.physical_order_items.find(candidate => candidate.id === claim.order_item_id);
      if (!order || !item?.rental_start_date) throw new Error('找不到租借提醒內容');

      const todayTime = Date.parse(`${taipeiToday()}T00:00:00Z`);
      const startTime = Date.parse(`${item.rental_start_date}T00:00:00Z`);
      const daysUntil = Math.max(0, Math.round((startTime - todayTime) / 86_400_000));
      const sent = await sendTelegramMessage(settings, [
        `<b>手機出租 ${daysUntil} 天後開始</b>`,
        `訂單：<code>${escapeTelegramHtml(order.id)}</code>`,
        `商品：${escapeTelegramHtml(item.product_name)} × ${item.quantity}`,
        `期間：${formatDate(item.rental_start_date)} 至 ${formatDate(item.rental_end_date)}（${item.rental_days || '-'} 天）`,
        `客戶：${escapeTelegramHtml(order.customer_email)}`,
        `聯絡：${escapeTelegramHtml(order.recipient_name)} / ${escapeTelegramHtml(order.recipient_phone)}`,
        `${order.delivery_method === 'pickup' ? '面交' : '地址'}：${escapeTelegramHtml(`${order.postal_code || ''} ${order.shipping_address}`.trim())}`,
        order.shipping_note ? `備註：${escapeTelegramHtml(order.shipping_note)}` : '',
        `後台：${adminOrderUrl()}`
      ], 'Failed to send rental start Telegram reminder');
      if (sent) sentCount += 1;
      else {
        failedCount += 1;
        await releaseReminderClaim(supabase, claim.order_item_id);
      }
    } catch (claimError) {
      failedCount += 1;
      console.error('Failed to prepare rental start Telegram reminder:', claimError);
      await releaseReminderClaim(supabase, claim.order_item_id);
    }
  }

  return { claimed: claims.length, sent: sentCount, failed: failedCount };
}
