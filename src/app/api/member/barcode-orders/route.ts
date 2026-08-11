import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'barcode-payment-proofs';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': {
    extension: 'jpg',
    signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  'image/png': {
    extension: 'png',
    signature: bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  },
  'image/webp': {
    extension: 'webp',
    signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  },
  'application/pdf': {
    extension: 'pdf',
    signature: bytes => String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
  }
};

async function addProofUrl(supabase: ReturnType<typeof getServerSupabase>, order: Record<string, unknown>) {
  const path = typeof order.payment_proof_path === 'string' ? order.payment_proof_path : '';
  if (!path) return { ...order, payment_proof_url: null };
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return { ...order, payment_proof_url: data?.signedUrl || null };
}

async function getCustomerId(supabase: ReturnType<typeof getServerSupabase>, email: string) {
  const { data, error } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(supabase, user.email.toLowerCase());
    if (!customerId) return NextResponse.json({ orders: [] });

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, created_at, updated_at, total_amount,
        payment_method, payment_status, order_status,
        ecpay_merchant_trade_no, payment_proof_path, payment_proof_uploaded_at,
        ecpay_barcode_1, ecpay_barcode_2, ecpay_barcode_3, ecpay_barcode_expires_at,
        manual_payment_confirmed_at, ecpay_paid_at,
        order_items ( id, price, products ( name, country, validity_days ) )
      `)
      .eq('customer_id', customerId)
      .eq('ecpay_payment_method', 'BARCODE')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    const orders = await Promise.all((data || []).map(order => addProofUrl(supabase, order)));
    return NextResponse.json({ orders });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Fetch member barcode orders error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取超商付款訂單失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedPath = '';
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getServerSupabase();
    const customerId = await getCustomerId(supabase, user.email.toLowerCase());
    if (!customerId) return NextResponse.json({ error: '找不到會員資料' }, { status: 404 });

    const formData = await request.formData();
    const orderId = String(formData.get('orderId') || '');
    const file = formData.get('receipt');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: '訂單編號格式不正確' }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: '請選擇繳款收據' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: '收據檔案不可超過 5MB' }, { status: 400 });

    const fileType = FILE_TYPES[file.type];
    if (!fileType) return NextResponse.json({ error: '收據僅支援 JPG、PNG、WebP 或 PDF' }, { status: 400 });
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!fileType.signature(fileBytes)) return NextResponse.json({ error: '收據檔案內容與格式不符' }, { status: 400 });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_status, payment_proof_path')
      .eq('id', orderId)
      .eq('customer_id', customerId)
      .eq('ecpay_payment_method', 'BARCODE')
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: '找不到這筆超商付款訂單' }, { status: 404 });
    if (order.payment_status === 'PAID') return NextResponse.json({ error: '此訂單已確認付款，不需再上傳收據' }, { status: 400 });

    uploadedPath = `${user.id}/${order.id}/${crypto.randomUUID()}.${fileType.extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, fileBytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });
    if (uploadError) throw uploadError;

    const uploadedAt = new Date().toISOString();
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({ payment_proof_path: uploadedPath, payment_proof_uploaded_at: uploadedAt, updated_at: uploadedAt })
      .eq('id', order.id)
      .eq('payment_status', 'PENDING')
      .select('id');
    if (updateError) throw updateError;
    if (!updatedOrders?.length) {
      await supabase.storage.from(BUCKET).remove([uploadedPath]);
      uploadedPath = '';
      return NextResponse.json({ error: '訂單付款狀態已更新，請重新整理' }, { status: 409 });
    }

    if (order.payment_proof_path && order.payment_proof_path !== uploadedPath) {
      await supabase.storage.from(BUCKET).remove([order.payment_proof_path]);
    }
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(uploadedPath, 300);
    uploadedPath = '';
    return NextResponse.json({ success: true, uploadedAt, paymentProofUrl: signed?.signedUrl || null });
  } catch (error) {
    if (uploadedPath) {
      try {
        await getServerSupabase().storage.from(BUCKET).remove([uploadedPath]);
      } catch (cleanupError) {
        console.error('Clean up receipt upload failed:', cleanupError);
      }
    }
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Upload barcode receipt error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '收據上傳失敗' }, { status: 500 });
  }
}
