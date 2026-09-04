import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAdminUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const VERIFICATION_SELECT = 'id, customer_id, status, submitted_at, reviewed_at, review_note, id_front_path, id_back_path, selfie_path';

async function signVerificationImages(supabase: ReturnType<typeof getServerSupabase>, verification: {
  id_front_path: string;
  id_back_path: string;
  selfie_path: string;
}) {
  const { data: signed, error } = await supabase.storage.from('identity-verifications').createSignedUrls([
    verification.id_front_path, verification.id_back_path, verification.selfie_path
  ], 300);
  if (error) throw error;
  return {
    idFront: signed?.[0]?.signedUrl || null,
    idBack: signed?.[1]?.signedUrl || null,
    selfie: signed?.[2]?.signedUrl || null
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const detailId = new URL(request.url).searchParams.get('id');
    if (detailId) {
      const { data: verification, error } = await supabase.from('customer_identity_verifications')
        .select(VERIFICATION_SELECT).eq('id', detailId).maybeSingle();
      if (error) throw error;
      if (!verification) return NextResponse.json({ error: '找不到實名認證資料' }, { status: 404 });
      const [{ data: customer, error: customerError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from('customers').select('id, name, email').eq('id', verification.customer_id).maybeSingle(),
        supabase.from('customer_private_profiles').select('legal_name, national_id, birth_date, residential_address').eq('customer_id', verification.customer_id).maybeSingle()
      ]);
      if (customerError) throw customerError;
      if (profileError) throw profileError;
      return NextResponse.json({ verification: {
        ...verification,
        ...(profile || {}),
        customer: customer || null,
        images: await signVerificationImages(supabase, verification)
      } });
    }
    const { data: verifications, error } = await supabase.from('customer_identity_verifications')
      .select(VERIFICATION_SELECT)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    const customerIds = [...new Set((verifications || []).map(item => item.customer_id))];
    const { data: customers, error: customersError } = customerIds.length
      ? await supabase.from('customers').select('id, name, email').in('id', customerIds)
      : { data: [], error: null };
    if (customersError) throw customersError;
    const customerMap = new Map((customers || []).map(customer => [customer.id, customer]));
    const rows = (verifications || []).map(verification => ({
        id: verification.id,
        status: verification.status,
        submitted_at: verification.submitted_at,
        reviewed_at: verification.reviewed_at,
        review_note: verification.review_note,
        customer: customerMap.get(verification.customer_id) || null,
        images: null
      }));
    return NextResponse.json({ verifications: rows });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取實名認證失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const id = String(body.id || '');
    const status = String(body.status || '');
    const reviewNote = String(body.reviewNote || '').trim().slice(0, 500);
    if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: '審核狀態不正確' }, { status: 400 });
    }
    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: '退回補件時請填寫原因' }, { status: 400 });
    }
    const { error } = await getServerSupabase().from('customer_identity_verifications').update({
      status,
      review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '審核更新失敗' }, { status: 500 });
  }
}
