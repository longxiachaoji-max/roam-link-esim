import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

const DEFAULTS: ContactInfo = {
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

function parseContactInfo(usageGuide: string | null): Partial<ContactInfo> {
  const match = (usageGuide || '').match(CONTACT_INFO_PATTERN);
  if (!match?.[1]) return {};

  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function stripContactInfo(usageGuide: string | null) {
  return (usageGuide || '').replace(CONTACT_INFO_PATTERN, '').trim();
}

function withContactInfo(usageGuide: string | null, settings: ContactInfo) {
  const cleanGuide = stripContactInfo(usageGuide);
  const encoded = Buffer.from(JSON.stringify(settings), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--CONTACT_INFO:${encoded}-->`;
}

function normalizeContactItems(config: Partial<ContactInfo>): ContactItem[] {
  if (Array.isArray(config.contact_items)) {
    const items = config.contact_items
      .map((item, index) => ({
        id: String(item.id || `contact-${Date.now()}-${index}`),
        label: String(item.label || '').trim(),
        value: String(item.value || '').trim(),
        href: String(item.href || '').trim()
      }))
      .filter(item => item.label && item.value);

    if (items.length > 0) return items;
  }

  const legacyItems: ContactItem[] = [];
  if (config.contact_email || DEFAULTS.contact_email) {
    const email = String(config.contact_email || DEFAULTS.contact_email).trim();
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

function normalizeSettings(data: any): ContactInfo {
  const config = parseContactInfo(data?.usage_guide);
  const contactItems = normalizeContactItems(config);
  return {
    contact_title: config.contact_title || DEFAULTS.contact_title,
    contact_email: contactItems.find(item => item.id === 'email')?.value || config.contact_email || DEFAULTS.contact_email,
    contact_phone: contactItems.find(item => item.id === 'phone')?.value || config.contact_phone || DEFAULTS.contact_phone,
    contact_note: config.contact_note || DEFAULTS.contact_note,
    contact_items: contactItems
  };
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
    const contactItems = normalizeContactItems({
      contact_items: Array.isArray(body.contact_items) ? body.contact_items : [],
      contact_email: body.contact_email,
      contact_phone: body.contact_phone
    });
    const nextSettings: ContactInfo = {
      contact_title: String(body.contact_title || DEFAULTS.contact_title).trim(),
      contact_email: contactItems.find(item => item.id === 'email')?.value || contactItems[0]?.value || DEFAULTS.contact_email,
      contact_phone: contactItems.find(item => item.id === 'phone')?.value || '',
      contact_note: String(body.contact_note || '').trim(),
      contact_items: contactItems
    };

    const { data: current, error: readError } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('site_settings')
      .update({
        usage_guide: withContactInfo(current?.usage_guide || '', nextSettings),
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
