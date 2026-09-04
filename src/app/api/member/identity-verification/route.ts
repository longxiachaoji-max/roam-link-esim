import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { prepareIdentityImage } from '@/lib/identity-images';

export const dynamic = 'force-dynamic';

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
      .select('id, status, submitted_at, reviewed_at, review_note')
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

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  try {
    const user = await requireAuthenticatedUser(request);
    const form = await request.formData();
    const idFront = form.get('idFront');
    const idBack = form.get('idBack');
    const selfie = form.get('selfie');
    if (!(idFront instanceof File) || !(idBack instanceof File) || !(selfie instanceof File)) {
      return NextResponse.json({ error: '請上傳身分證正面、反面及本人自拍照' }, { status: 400 });
    }

    const [frontBuffer, backBuffer, selfieBuffer] = await Promise.all([
      prepareIdentityImage(idFront, true),
      prepareIdentityImage(idBack, true),
      prepareIdentityImage(selfie, false)
    ]);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(user.email, String(user.user_metadata?.name || ''));
    const verificationId = crypto.randomUUID();
    const basePath = `${customerId}/${verificationId}`;
    const files = [
      { path: `${basePath}/id-front.jpg`, body: frontBuffer },
      { path: `${basePath}/id-back.jpg`, body: backBuffer },
      { path: `${basePath}/selfie.jpg`, body: selfieBuffer }
    ];
    for (const file of files) {
      const { error } = await supabase.storage.from('identity-verifications').upload(file.path, file.body, {
        contentType: 'image/jpeg', upsert: false, cacheControl: '0'
      });
      if (error) throw error;
      uploadedPaths.push(file.path);
    }

    const { data: previous } = await supabase.from('customer_identity_verifications')
      .select('id_front_path, id_back_path, selfie_path').eq('customer_id', customerId).maybeSingle();
    const { error: saveError } = await supabase.from('customer_identity_verifications').upsert({
      id: verificationId,
      customer_id: customerId,
      status: 'PENDING',
      id_front_path: files[0].path,
      id_back_path: files[1].path,
      selfie_path: files[2].path,
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
      ].filter(Boolean));
    }
    return NextResponse.json({ success: true, verification: { status: 'PENDING' } });
  } catch (error) {
    if (uploadedPaths.length) await getServerSupabase().storage.from('identity-verifications').remove(uploadedPaths);
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: error instanceof Error ? error.message : '實名認證送出失敗' }, { status: 500 });
  }
}
