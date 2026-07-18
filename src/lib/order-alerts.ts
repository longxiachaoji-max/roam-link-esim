const NOTIFICATION_CONFIG_PATTERN = /\n?<!--NOTIFICATION_SETTINGS:([\s\S]*?)-->\n?/;

interface NotificationSettings {
  notify_telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

interface SupabaseLike {
  from: (table: string) => any;
}

export interface MicroesimFailureAlert {
  source: string;
  orderId?: string | null;
  orderItemId?: string | null;
  customerEmail?: string | null;
  productName?: string | null;
  country?: string | null;
  validityDays?: number | string | null;
  supplierPlanId?: string | null;
  error: unknown;
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return '未知錯誤';
  }
}

async function getNotificationSettings(supabase: SupabaseLike): Promise<NotificationSettings> {
  const fallback = {
    notify_telegram_enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || ''
  };

  try {
    const { data } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();
    const match = (data?.usage_guide || '').match(NOTIFICATION_CONFIG_PATTERN);
    if (!match?.[1]) return fallback;

    const config = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as Partial<NotificationSettings>;
    return {
      notify_telegram_enabled: config.notify_telegram_enabled ?? fallback.notify_telegram_enabled,
      telegram_bot_token: config.telegram_bot_token || fallback.telegram_bot_token,
      telegram_chat_id: config.telegram_chat_id || fallback.telegram_chat_id
    };
  } catch {
    return fallback;
  }
}

export async function sendMicroesimFulfillmentFailureAlert(
  supabase: SupabaseLike,
  alert: MicroesimFailureAlert
) {
  const settings = await getNotificationSettings(supabase);
  if (!settings.notify_telegram_enabled || !settings.telegram_bot_token || !settings.telegram_chat_id) return;

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space'}/admin/orders`;
  const errorMessage = getErrorMessage(alert.error);
  const lines = [
    '<b>MicroEsim 自動配發失敗</b>',
    `來源：${escapeTelegramHtml(alert.source || '-')}`,
    alert.orderId ? `訂單：<code>${escapeTelegramHtml(alert.orderId)}</code>` : '',
    alert.orderItemId ? `項目：<code>${escapeTelegramHtml(alert.orderItemId)}</code>` : '',
    alert.customerEmail ? `客戶：${escapeTelegramHtml(alert.customerEmail)}` : '',
    alert.productName ? `商品：${escapeTelegramHtml(alert.productName)}` : '',
    alert.country ? `國家：${escapeTelegramHtml(alert.country)}` : '',
    alert.validityDays ? `天數：${escapeTelegramHtml(String(alert.validityDays))}` : '',
    alert.supplierPlanId ? `Micro 方案 ID：<code>${escapeTelegramHtml(alert.supplierPlanId)}</code>` : '',
    `錯誤：${escapeTelegramHtml(errorMessage)}`,
    `後台：${adminUrl}`
  ].filter(Boolean);

  try {
    const response = await fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegram_chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        text: lines.join('\n')
      })
    });
    if (!response.ok) {
      console.error('Failed to send MicroEsim failure Telegram alert:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send MicroEsim failure Telegram alert:', error);
  }
}
