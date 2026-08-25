import { NextResponse } from 'next/server';
import { markEcpayOrderPaidAndFulfill } from '@/lib/ecpay-orders';
import { markEcpayTopupPaid } from '@/lib/ecpay-topups';
import { AuthenticationError, getServerSupabase, requireAdminUser } from '@/lib/server-auth';
import { expirePendingBarcodeOrders } from '@/lib/barcode-order-expiry';

export const dynamic = 'force-dynamic';

const BUCKET = 'barcode-payment-proofs';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': { extension: 'jpg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  'image/webp': {
    extension: 'webp',
    signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  },
  'application/pdf': { extension: 'pdf', signature: bytes => String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' }
};

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Admin barcode payment error:', error);
  return NextResponse.json({ error: error instanceof Error ? error.message : '超商付款操作失敗' }, { status: 500 });
}

async function addProofUrl(supabase: ReturnType<typeof getServerSupabase>, order: Record<string, unknown>) {
  const path = typeof order.payment_proof_path === 'string' ? order.payment_proof_path : '';
  if (!path) return { ...order, payment_proof_url: null };
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return { ...order, payment_proof_url: data?.signedUrl || null };
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    await expirePendingBarcodeOrders(supabase);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, created_at, updated_at, total_amount,
        payment_method, payment_status, order_status,
        ecpay_merchant_trade_no, payment_proof_path, payment_proof_uploaded_at,
        ecpay_barcode_expires_at,
        manual_payment_confirmed_at, ecpay_paid_at,
        customers ( email, name ),
        order_items ( id, price, inventory_id, products ( name, country, validity_days ) )
      `)
      .eq('ecpay_payment_method', 'BARCODE')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const orders = await Promise.all((data || []).map(order => addProofUrl(supabase, order)));
    return NextResponse.json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let uploadedPath = '';
  try {
    const admin = await requireAdminUser(request);
    const supabase = getServerSupabase();
    await expirePendingBarcodeOrders(supabase);

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
      .select('id, payment_status, payment_proof_path, ecpay_payment_method')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.ecpay_payment_method !== 'BARCODE') return NextResponse.json({ error: '找不到這筆超商付款訂單' }, { status: 404 });
    if (order.payment_status === 'PAID') return NextResponse.json({ error: '此訂單已確認付款，不需再上傳收據' }, { status: 400 });

    uploadedPath = `admin/${admin.id}/${order.id}/${crypto.randomUUID()}.${fileType.extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, fileBytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });
    if (uploadError) throw uploadError;

    const uploadedAt = new Date().toISOString();
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_proof_path: uploadedPath,
        payment_proof_uploaded_at: uploadedAt,
        payment_status: 'PENDING',
        order_status: 'CREATED',
        updated_at: uploadedAt
      })
      .eq('id', order.id)
      .neq('payment_status', 'PAID')
      .select('id');
    if (updateError) throw updateError;
    if (!updatedOrders?.length) {
      await supabase.storage.from(BUCKET).remove([uploadedPath]);
      uploadedPath = '';
      return NextResponse.json({ error: '此訂單已完成付款，不需再上傳收據' }, { status: 409 });
    }

    if (order.payment_proof_path && order.payment_proof_path !== uploadedPath) {
      await supabase.storage.from(BUCKET).remove([order.payment_proof_path]);
    }
    uploadedPath = '';
    return NextResponse.json({ success: true, message: '收據已上傳，訂單已列為待審核' });
  } catch (error) {
    if (uploadedPath) {
      try {
        await getServerSupabase().storage.from(BUCKET).remove([uploadedPath]);
      } catch (cleanupError) {
        console.error('Clean up admin receipt upload failed:', cleanupError);
      }
    }
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const orderId = String(body.orderId || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ error: '訂單編號格式不正確' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total_amount, payment_method, payment_status, ecpay_payment_method')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 });
    if (order.ecpay_payment_method !== 'BARCODE') {
      return NextResponse.json({ error: '此訂單不是超商付款' }, { status: 400 });
    }
    if (order.payment_status === 'PAID') {
      return NextResponse.json({ success: true, alreadyProcessed: true, message: '此訂單已確認付款' });
    }
    if (order.payment_status !== 'PENDING') {
      return NextResponse.json({ error: '此訂單已逾期；請先上傳收據恢復為待審核，再確認放行' }, { status: 400 });
    }

    const amount = Math.round(Number(order.total_amount));
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: '訂單金額不正確' }, { status: 400 });
    }

    if (order.payment_method === 'ECPAY_TOPUP') {
      await markEcpayTopupPaid(order.id, amount, { source: 'manual', adminUserId: admin.id });
      return NextResponse.json({ success: true, message: '已確認收據，儲值金已加入會員帳戶' });
    }
    if (order.payment_method === 'ECPAY') {
      const result = await markEcpayOrderPaidAndFulfill(order.id, amount, { source: 'manual', adminUserId: admin.id });
      const pendingCount = result.pendingItems?.length || 0;
      return NextResponse.json({
        success: true,
        message: pendingCount ? `付款已確認，仍有 ${pendingCount} 張 eSIM 正在配發` : '付款已確認，eSIM 已完成配發'
      });
    }

    return NextResponse.json({ error: '不支援此訂單類型' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
