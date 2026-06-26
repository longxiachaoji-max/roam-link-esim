import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const HIDDEN_CONFIG_PATTERN = /\n?<!--(?:PRODUCT_SORT_CONFIG|NOTIFICATION_SETTINGS|CONTACT_INFO|TRAFFIC_ANALYTICS|REFERRAL_CONFIG|PAYMENT_LIMITS):[\s\S]*?-->\n?/g;
const CONTACT_INFO_PATTERN = /\n?<!--CONTACT_INFO:([\s\S]*?)-->\n?/;

interface ContactInfo {
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  contact_note: string;
  contact_items: ContactItem[];
}

interface ContactItem {
  id: string;
  label: string;
  value: string;
  href: string;
}

const DEFAULT_CONTACT_INFO: ContactInfo = {
  contact_title: '聯絡資訊',
  contact_email: 'roamlinktw@gmail.com',
  contact_phone: '',
  contact_note: '如需商品或訂單協助，請透過以下方式與我們聯繫。',
  contact_items: [
    {
      id: 'email',
      label: '客服信箱',
      value: 'roamlinktw@gmail.com',
      href: 'mailto:roamlinktw@gmail.com'
    }
  ]
};

function stripSortConfig(usageGuide: string | null) {
  return (usageGuide || '').replace(HIDDEN_CONFIG_PATTERN, '').trim();
}

function parseContactInfo(usageGuide: string | null): ContactInfo {
  const match = (usageGuide || '').match(CONTACT_INFO_PATTERN);
  if (!match?.[1]) return DEFAULT_CONTACT_INFO;

  try {
    const config = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    const contactItems = normalizeContactItems(config);
    return {
      contact_title: config.contact_title || DEFAULT_CONTACT_INFO.contact_title,
      contact_email: contactItems.find(item => item.id === 'email')?.value || config.contact_email || DEFAULT_CONTACT_INFO.contact_email,
      contact_phone: contactItems.find(item => item.id === 'phone')?.value || config.contact_phone || DEFAULT_CONTACT_INFO.contact_phone,
      contact_note: config.contact_note || DEFAULT_CONTACT_INFO.contact_note,
      contact_items: contactItems
    };
  } catch {
    return DEFAULT_CONTACT_INFO;
  }
}

function normalizeContactItems(config: Partial<ContactInfo>): ContactItem[] {
  if (Array.isArray(config.contact_items)) {
    const items = config.contact_items
      .map((item, index) => ({
        id: String(item.id || `contact-${index}`),
        label: String(item.label || '').trim(),
        value: String(item.value || '').trim(),
        href: String(item.href || '').trim()
      }))
      .filter(item => item.label && item.value);

    if (items.length > 0) return items;
  }

  const legacyItems: ContactItem[] = [];
  if (config.contact_email || DEFAULT_CONTACT_INFO.contact_email) {
    const email = String(config.contact_email || DEFAULT_CONTACT_INFO.contact_email).trim();
    legacyItems.push({
      id: 'email',
      label: '客服信箱',
      value: email,
      href: `mailto:${email}`
    });
  }
  if (config.contact_phone) {
    const phone = String(config.contact_phone).trim();
    legacyItems.push({
      id: 'phone',
      label: '客服電話',
      value: phone,
      href: `tel:${phone.replace(/[^+\d]/g, '')}`
    });
  }
  return legacyItems;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_badge, hero_title, hero_subtitle, section_title, usage_guide')
      .eq('id', 'main')
      .single();

    if (error) {
      // 回傳預設值
      return NextResponse.json({
        settings: {
          hero_badge: '一飛通全球漫遊 · 2026 全新上線',
          hero_title: '隨時隨地，全球無縫連線',
          hero_subtitle: '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
          section_title: '熱門目的地',
          usage_guide: '',
          ...DEFAULT_CONTACT_INFO
        }
      });
    }

    const contactInfo = parseContactInfo(data.usage_guide);

    return NextResponse.json({
      settings: {
        ...data,
        usage_guide: stripSortConfig(data.usage_guide),
        ...contactInfo
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
