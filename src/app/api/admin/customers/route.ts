import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, email, name, token_balance, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customerIds = (customers || []).map(customer => customer.id);
    const [{ data: profiles, error: profileError }, { data: verifications, error: verificationError }] = customerIds.length
      ? await Promise.all([
        supabase.from('customer_private_profiles').select('customer_id, legal_name, national_id, birth_date, residential_address').in('customer_id', customerIds),
        supabase.from('customer_identity_verifications').select('id, customer_id, status, submitted_at, reviewed_at, review_note').in('customer_id', customerIds)
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (profileError) throw profileError;
    if (verificationError) throw verificationError;
    const profileMap = new Map((profiles || []).map(profile => [profile.customer_id, profile]));
    const verificationMap = new Map((verifications || []).map(verification => [verification.customer_id, verification]));
    return NextResponse.json({ customers: (customers || []).map(customer => ({
      ...customer,
      private_profile: profileMap.get(customer.id) || null,
      identity_verification: verificationMap.get(customer.id) || null
    })) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const customerId = String(body.customerId || '').trim();
    const legalName = String(body.legalName || '').trim().slice(0, 80) || null;
    const nationalId = String(body.nationalId || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 30) || null;
    const birthDate = String(body.birthDate || '').trim() || null;
    const residentialAddress = String(body.residentialAddress || '').trim().slice(0, 300) || null;
    if (!customerId) return NextResponse.json({ error: '找不到會員資料' }, { status: 400 });
    if (nationalId && !/^[A-Z0-9-]{4,30}$/.test(nationalId)) return NextResponse.json({ error: '身分證字號格式不正確' }, { status: 400 });
    if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate < '1900-01-01' || birthDate > new Date().toISOString().slice(0, 10))) {
      return NextResponse.json({ error: '生日日期不正確' }, { status: 400 });
    }
    if (residentialAddress && residentialAddress.length < 5) return NextResponse.json({ error: '請填寫完整地址' }, { status: 400 });
    const { data, error } = await supabase.from('customer_private_profiles').upsert({
      customer_id: customerId,
      legal_name: legalName,
      national_id: nationalId,
      birth_date: birthDate,
      residential_address: residentialAddress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'customer_id' }).select('customer_id, legal_name, national_id, birth_date, residential_address').single();
    if (error?.code === '23505') return NextResponse.json({ error: '此身分證字號已由其他會員使用' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ success: true, profile: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '會員基本資料儲存失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { customerId, amount, reason, paymentReceivedAmount } = await request.json();

    if (!customerId || amount === undefined || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    const receivedAmount = Number(paymentReceivedAmount ?? (numericAmount > 0 ? numericAmount : 0));

    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
      return NextResponse.json({ error: 'Invalid received amount' }, { status: 400 });
    }

    // 1. Fetch current balance
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('token_balance')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const newBalance = Math.max(0, customer.token_balance + numericAmount);

    // 2. Update balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('id', customerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Record transaction
    const { error: txError } = await supabase
      .from('token_transactions')
      .insert([{
        customer_id: customerId,
        amount: numericAmount,
        transaction_type: numericAmount < 0 ? 'purchase' : 'topup',
        balance_after: newBalance,
        reason: `[收款金額:${receivedAmount}] ${reason}`
      }]);

    if (txError) {
      console.error('Failed to record transaction:', txError);
      // Rollback the balance update to maintain data integrity
      await supabase
        .from('customers')
        .update({ token_balance: customer.token_balance }) // Revert to the old balance
        .eq('id', customerId);
        
      return NextResponse.json({ error: `Transaction record failed: ${txError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
