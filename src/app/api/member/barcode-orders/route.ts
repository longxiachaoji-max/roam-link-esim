import { NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { sendBarcodeReceiptUploadedAlert } from '@/lib/barcode-payment-alerts';
import { createMerchantTradeNo, sanitizeEcpayText } from '@/lib/ecpay';
import { createEcpayBackgroundBarcode } from '@/lib/ecpay-background-barcode';

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

interface MemberBarcodeOrder extends Record<string, unknown> {
  id: string;
  order_number: string | null;
  total_amount: number | string;
  payment_method: string;
  payment_status: string;
  payment_proof_uploaded_at: string | null;
  ecpay_barcode_1: string | null;
  ecpay_barcode_2: string | null;
  ecpay_barcode_3: string | null;
  order_items: Array<{
    products: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>;
}

function barcodeItemNames(order: MemberBarcodeOrder) {
  if (order.payment_method === 'ECPAY_TOPUP') return ['一飛通儲值金'];
  return (order.order_items || []).flatMap(item => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    return product?.name ? [product.name] : [];
  });
}

async function ensureStoredBarcode(
  supabase: ReturnType<typeof getServerSupabase>,
  order: MemberBarcodeOrder,
  origin: string
) {
  if (
    order.payment_status === 'PAID'
    || order.payment_proof_uploaded_at
    || (order.ecpay_barcode_1 && order.ecpay_barcode_2 && order.ecpay_barcode_3)
  ) return order;

  const merchantTradeNo = createMerchantTradeNo();
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('orders')
    .update({
      ecpay_merchant_trade_no: merchantTradeNo,
      ecpay_barcode_created_at: claimedAt,
      updated_at: claimedAt
    })
    .eq('id', order.id)
    .eq('payment_status', 'PENDING')
    .eq('ecpay_payment_method', 'BARCODE')
    .is('ecpay_barcode_1', null)
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return order;

  try {
    const itemNames = barcodeItemNames(order);
    const isTopup = order.payment_method === 'ECPAY_TOPUP';
    const barcode = await createEcpayBackgroundBarcode({
      merchantTradeNo,
      amount: Math.round(Number(order.total_amount)),
      orderId: order.id,
      returnUrl: `${origin}${isTopup ? '/api/ecpay/topup/notify' : '/api/ecpay/notify'}`,
      expireDays: 3,
      tradeDesc: isTopup ? 'FirstRoamLink member topup' : 'Roam Link eSIM',
      itemName: sanitizeEcpayText(itemNames.join('#'), 200) || (isTopup ? '一飛通儲值金' : 'Roam Link eSIM')
    });
    const savedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from('orders')
      .update({
        ecpay_trade_no: barcode.tradeNo || null,
        ecpay_barcode_1: barcode.barcode1,
        ecpay_barcode_2: barcode.barcode2,
        ecpay_barcode_3: barcode.barcode3,
        ecpay_barcode_expires_at: barcode.expiresAt,
        ecpay_barcode_created_at: savedAt,
        updated_at: savedAt
      })
      .eq('id', order.id)
      .eq('ecpay_merchant_trade_no', merchantTradeNo);
    if (saveError) throw saveError;
    return {
      ...order,
      ecpay_merchant_trade_no: merchantTradeNo,
      ecpay_barcode_1: barcode.barcode1,
      ecpay_barcode_2: barcode.barcode2,
      ecpay_barcode_3: barcode.barcode3,
      ecpay_barcode_expires_at: barcode.expiresAt
    };
  } catch (error) {
    await supabase
      .from('orders')
      .update({ ecpay_merchant_trade_no: null, ecpay_barcode_created_at: null, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('ecpay_merchant_trade_no', merchantTradeNo);
    console.error('Generate missing member barcode failed:', { orderId: order.id, error });
    return order;
  }
}

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

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const preparedOrders: MemberBarcodeOrder[] = [];
    for (const order of (data || []) as unknown as MemberBarcodeOrder[]) {
      preparedOrders.push(await ensureStoredBarcode(supabase, order, origin));
    }
    const orders = await Promise.all(preparedOrders.map(order => addProofUrl(supabase, order)));
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
      .select(`
        id, order_number, total_amount, payment_method, payment_status,
        ecpay_merchant_trade_no, payment_proof_path,
        order_items ( products ( name ) )
      `)
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
    const itemNames = (order.order_items || []).flatMap(item => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      return product?.name ? [product.name] : [];
    });
    await sendBarcodeReceiptUploadedAlert(supabase, {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: user.email,
      amount: Number(order.total_amount),
      purpose: order.payment_method === 'ECPAY_TOPUP' ? '會員儲值' : 'eSIM 商品',
      itemNames: order.payment_method === 'ECPAY_TOPUP' ? ['一飛通儲值金'] : itemNames,
      merchantTradeNo: order.ecpay_merchant_trade_no
    });
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
