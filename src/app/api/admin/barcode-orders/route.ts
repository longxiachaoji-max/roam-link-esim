import { NextResponse } from 'next/server';
import { markEcpayOrderPaidAndFulfill } from '@/lib/ecpay-orders';
import { markEcpayTopupPaid } from '@/lib/ecpay-topups';
import { AuthenticationError, getServerSupabase, requireAdminUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'barcode-payment-proofs';

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
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, created_at, updated_at, total_amount,
        payment_method, payment_status, order_status,
        ecpay_merchant_trade_no, payment_proof_path, payment_proof_uploaded_at,
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
