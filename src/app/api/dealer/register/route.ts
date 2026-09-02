import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { normalizeDealerSalesMode } from '@/lib/dealer-sales-mode';

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const storeName = text(body.storeName, 120);
    const contactName = text(body.contactName, 80);
    const phone = text(body.phone, 40);
    const taxId = text(body.taxId, 20);
    const salesMode = normalizeDealerSalesMode(body.salesMode);
    if (!storeName || !contactName || !phone) {
      return NextResponse.json({ error: '請填寫店家名稱、聯絡人與電話' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: existingByEmail, error: existingError } = await supabase
      .from('dealers')
      .select('id, user_id, email, store_name, contact_name, phone, status, balance, sales_mode, referral_code, referral_share_percent')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingByEmail && existingByEmail.user_id !== user.id) {
      return NextResponse.json({ error: '此 Email 已綁定其他經銷商帳號' }, { status: 409 });
    }

    if (existingByEmail?.status === 'approved' || existingByEmail?.status === 'suspended') {
      return NextResponse.json({
        dealer: {
          id: existingByEmail.id,
          email: existingByEmail.email,
          store_name: existingByEmail.store_name,
          contact_name: existingByEmail.contact_name,
          phone: existingByEmail.phone,
          status: existingByEmail.status,
          balance: existingByEmail.balance,
          sales_mode: existingByEmail.sales_mode,
          referral_code: existingByEmail.referral_code,
          referral_share_percent: existingByEmail.referral_share_percent
        }
      });
    }

    const payload = {
      user_id: user.id,
      email: user.email.toLowerCase(),
      store_name: storeName,
      contact_name: contactName,
      phone,
      tax_id: taxId || null,
      sales_mode: salesMode,
      status: 'pending'
    };
    const query = existingByEmail
      ? supabase.from('dealers').update(payload).eq('id', existingByEmail.id)
      : supabase.from('dealers').insert(payload);
    const { data, error } = await query
      .select('id, email, store_name, contact_name, phone, status, balance, sales_mode, referral_code, referral_share_percent')
      .single();
    if (error) throw error;
    return NextResponse.json({ dealer: data });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Dealer registration failed:', error);
    return NextResponse.json({ error: '送出申請失敗，請稍後再試' }, { status: 500 });
  }
}
