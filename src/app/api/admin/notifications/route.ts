import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

const NOTIFICATION_CONFIG_PATTERN = /\n?<!--NOTIFICATION_SETTINGS:([\s\S]*?)-->\n?/;

interface NotificationSettings {
  notify_email_enabled: boolean;
  order_notify_email: string;
  notify_telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

const DEFAULTS: NotificationSettings = {
  notify_email_enabled: true,
  order_notify_email: '',
  notify_telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: ''
};

function parseNotificationConfig(usageGuide: string | null): Partial<NotificationSettings> {
  const match = (usageGuide || '').match(NOTIFICATION_CONFIG_PATTERN);
  if (!match?.[1]) return {};

  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function stripNotificationConfig(usageGuide: string | null) {
  return (usageGuide || '').replace(NOTIFICATION_CONFIG_PATTERN, '').trim();
}

function withNotificationConfig(usageGuide: string | null, settings: NotificationSettings) {
  const cleanGuide = stripNotificationConfig(usageGuide);
  const encoded = Buffer.from(JSON.stringify(settings), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--NOTIFICATION_SETTINGS:${encoded}-->`;
}

function normalizeSettings(data: any): NotificationSettings {
  const config = parseNotificationConfig(data?.usage_guide);
  return {
    notify_email_enabled: config.notify_email_enabled ?? true,
    order_notify_email: config.order_notify_email || process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || '',
    notify_telegram_enabled: config.notify_telegram_enabled ?? false,
    telegram_bot_token: config.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id: config.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || ''
  };
}

async function sendTelegramTest(token: string, chatId: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Roam Link eSIM 訂單提醒測試成功',
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram 測試失敗：${text}`);
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      return NextResponse.json({ settings: DEFAULTS });
    }

    return NextResponse.json({ settings: normalizeSettings(data) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const nextSettings = {
      notify_email_enabled: Boolean(body.notify_email_enabled),
      order_notify_email: String(body.order_notify_email || '').trim(),
      notify_telegram_enabled: Boolean(body.notify_telegram_enabled),
      telegram_bot_token: String(body.telegram_bot_token || '').trim(),
      telegram_chat_id: String(body.telegram_chat_id || '').trim()
    };

    const { data: current, error: readError } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const updateData = {
      usage_guide: withNotificationConfig(current?.usage_guide || '', nextSettings),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('site_settings')
      .update(updateData)
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type;

    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = normalizeSettings(data);

    if (type === 'email') {
      if (!settings.order_notify_email) {
        return NextResponse.json({ error: '請先填寫提醒收件信箱' }, { status: 400 });
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      await resend.emails.send({
        from: `Roam Link eSIM <${fromEmail}>`,
        to: [settings.order_notify_email],
        subject: 'Roam Link eSIM 訂單提醒測試',
        html: '<p>這是一封後台訂單提醒測試信。若你收到這封信，代表 Mail 提醒設定正常。</p>'
      });

      return NextResponse.json({ success: true });
    }

    if (type === 'telegram') {
      if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
        return NextResponse.json({ error: '請先填寫 Telegram Bot Token 和 Chat ID' }, { status: 400 });
      }

      await sendTelegramTest(settings.telegram_bot_token, settings.telegram_chat_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知的測試類型' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
