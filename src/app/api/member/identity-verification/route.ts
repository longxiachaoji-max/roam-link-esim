import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_KINDS = new Set(['id-front', 'id-back', 'selfie']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function identityProfile(value: Record<string, unknown>) {
  const legalName = String(value.legalName || '').trim().slice(0, 80);
  const nationalId = String(value.nationalId || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 30);
  const birthDate = String(value.birthDate || '').trim();
  const residentialAddress = String(value.residentialAddress || '').trim().slice(0, 300);
  if (!legalName) throw new Error('請填寫真實姓名');
  if (!/^[A-Z0-9-]{4,30}$/.test(nationalId)) throw new Error('身分證字號格式不正確');
  if (!DATE_PATTERN.test(birthDate) || birthDate < '1900-01-01' || birthDate > new Date().toISOString().slice(0, 10)) throw new Error('生日日期不正確');
  if (residentialAddress.length < 5) throw new Error('請填寫完整地址');
  return { legalName, nationalId, birthDate, residentialAddress };
}

function getSubmissionId(value: unknown) {
  const submissionId = String(value || '').trim();
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) throw new Error('送出識別碼不正確，請重新送出');
  return submissionId;
}

function getIdentityPaths(customerId: string, submissionId: string) {
  const basePath = `${customerId}/${submissionId}`;
  return {
    front: `${basePath}/id-front.jpg`,
    back: `${basePath}/id-back.jpg`,
    selfie: `${basePath}/selfie.jpg`
  };
}

async function getCustomerId(email: string, name?: string) {
  const supabase = getServerSupabase();
  const { data: existing, error } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;
  const { data, error: insertError } = await supabase.from('customers').insert({
    email,
    name: name || email.split('@')[0],
    token_balance: 0
  }).select('id').single();
  if (insertError?.code === '23505') {
    const { data: concurrent, error: concurrentError } = await supabase.from('customers').select('id').eq('email', email).single();
    if (concurrentError) throw concurrentError;
    return concurrent.id;
  }
  if (insertError) throw insertError;
  return data.id;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    const { data, error } = await supabase
      .from('customer_identity_verifications')
      .select('id, status, submitted_at, reviewed_at, review_note, legal_name, national_id, birth_date, residential_address')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ verification: data || { status: 'NOT_SUBMITTED' } });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取實名認證失敗' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const profile = identityProfile(body);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    const { data, error } = await supabase.from('customer_identity_verifications').update({
      legal_name: profile.legalName,
      national_id: profile.nationalId,
      birth_date: profile.birthDate,
      residential_address: profile.residentialAddress,
      updated_at: new Date().toISOString()
    }).eq('customer_id', customerId).select('legal_name, national_id, birth_date, residential_address').maybeSingle();
    if (error?.code === '23505') return NextResponse.json({ error: '此身分證字號已由其他會員使用' }, { status: 409 });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: '請先完成實名認證資料上傳' }, { status: 400 });
    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '會員資料儲存失敗' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const form = await request.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || '');
    const submissionId = getSubmissionId(form.get('submissionId'));
    if (!(file instanceof File) || !IMAGE_KINDS.has(kind)) return NextResponse.json({ error: '照片資料不完整，請重新選擇' }, { status: 400 });

    // Keep the native image processor out of status-only requests.
    const { prepareIdentityImage } = await import('@/lib/identity-images');
    const image = await prepareIdentityImage(file, kind !== 'selfie');
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    const paths = getIdentityPaths(customerId, submissionId);
    const path = kind === 'id-front' ? paths.front : kind === 'id-back' ? paths.back : paths.selfie;
    const { error } = await supabase.storage.from('identity-verifications').upload(path, image, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '0'
    });
    if (error) throw error;
    return NextResponse.json({ success: true, kind });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '照片上傳失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json();
    const submissionId = getSubmissionId(body.submissionId);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    const paths = getIdentityPaths(customerId, submissionId);
    const { data: uploaded, error: listError } = await supabase.storage.from('identity-verifications')
      .list(`${customerId}/${submissionId}`, { limit: 10 });
    if (listError) throw listError;
    const names = new Set((uploaded || []).map(item => item.name));
    if (!['id-front.jpg', 'id-back.jpg', 'selfie.jpg'].every(name => names.has(name))) {
      return NextResponse.json({ error: '部分照片尚未上傳完成，請重新送出' }, { status: 400 });
    }

    const { data: previous } = await supabase.from('customer_identity_verifications')
      .select('id_front_path, id_back_path, selfie_path').eq('customer_id', customerId).maybeSingle();
    const { error: saveError } = await supabase.from('customer_identity_verifications').upsert({
      id: submissionId,
      customer_id: customerId,
      status: 'PENDING',
      id_front_path: paths.front,
      id_back_path: paths.back,
      selfie_path: paths.selfie,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'customer_id' });
    if (saveError) throw saveError;
    if (previous) {
      await supabase.storage.from('identity-verifications').remove([
        previous.id_front_path, previous.id_back_path, previous.selfie_path
      ].filter((path): path is string => typeof path === 'string' && !Object.values(paths).includes(path)));
    }
    return NextResponse.json({ success: true, verification: { status: 'PENDING' } });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '實名認證送出失敗' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const submissionId = getSubmissionId(new URL(request.url).searchParams.get('submissionId'));
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    await supabase.storage.from('identity-verifications').remove(Object.values(getIdentityPaths(customerId, submissionId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: '暫存照片清理失敗' }, { status: 500 });
  }
}
