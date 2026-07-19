import { NextResponse } from 'next/server';
import {
  createMerchantTradeNo,
  formatEcpayTradeDate,
  generateCheckMacValue,
  getEcpayConfig,
  sanitizeEcpayText
} from '@/lib/ecpay';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';
import { parsePaymentLimits } from '@/lib/payment-limits';

export const dynamic = 'force-dynamic';

type PaymentMethod = 'Credit' | 'BARCODE';

interface CheckoutItem {
  productId: string;
  quantity: number;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`請填寫${label}`);
  return text.slice(0, maxLength);
}

export async function POST(request: Request) {
  let orderId = '';
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!accessToken) return NextResponse.json({ error: '請先登入會員再結帳' }, { status: 401 });

    const supabase = getPhysicalStoreAdmin();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const authUser = authData.user;
    if (authError || !authUser?.email) return NextResponse.json({ error: '登入狀態已過期，請重新登入' }, { status: 401 });

    const body = await request.json();
    const paymentMethod = String(body.paymentMethod || 'Credit') as PaymentMethod;
    if (paymentMethod !== 'Credit' && paymentMethod !== 'BARCODE') {
      return NextResponse.json({ error: '不支援的付款方式' }, { status: 400 });
    }

    const rawItems: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 20) throw new Error('購物車內容不正確');
    const quantityByProduct = new Map<string, number>();
    for (const item of rawItems) {
      const productId = String(item.productId || '');
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('商品數量不正確');
      quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + quantity);
    }

    const productIds = [...quantityByProduct.keys()];
    const { data: products, error: productError } = await supabase
      .from('physical_products')
      .select('id, name, price, stock_quantity, images, is_active')
      .in('id', productIds)
      .eq('is_active', true);
    if (productError) throw productError;
    if ((products || []).length !== productIds.length) throw new Error('部分商品已下架，請重新整理購物車');

    const orderItems = (products || []).map(product => {
      const quantity = quantityByProduct.get(product.id) || 0;
      if (Number(product.stock_quantity) < quantity) throw new Error(`${product.name} 庫存不足`);
      return {
        product_id: product.id,
        product_name: product.name,
        product_image: Array.isArray(product.images) ? product.images[0] || null : null,
        quantity,
        unit_price: Math.round(Number(product.price))
      };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const shippingFee = 0;
    const totalAmount = subtotal + shippingFee;
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) throw new Error('訂單金額不正確');

    const { data: settings } = await supabase.from('site_settings').select('usage_guide').eq('id', 'main').single();
    const limits = parsePaymentLimits(settings?.usage_guide);
    const limit = paymentMethod === 'BARCODE'
      ? { min: limits.barcode_min, max: limits.barcode_max, label: '超商條碼付款' }
      : { min: limits.credit_min, max: limits.credit_max, label: '信用卡付款' };
    if (totalAmount < limit.min || totalAmount > limit.max) {
      throw new Error(`${limit.label}金額需介於 NT$${limit.min.toLocaleString()} 至 NT$${limit.max.toLocaleString()}`);
    }

    let { data: customer } = await supabase.from('customers').select('id').eq('email', authUser.email).maybeSingle();
    if (!customer) {
      const { data, error } = await supabase.from('customers').insert({
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email.split('@')[0],
        token_balance: 0
      }).select('id').single();
      if (error) throw error;
      customer = data;
    }

    const merchantTradeNo = createMerchantTradeNo();
    const { data: order, error: orderError } = await supabase.from('physical_orders').insert({
      customer_id: customer.id,
      customer_email: authUser.email,
      recipient_name: requiredText(body.recipientName, '收件人姓名', 80),
      recipient_phone: requiredText(body.recipientPhone, '聯絡電話', 30),
      postal_code: String(body.postalCode || '').trim().slice(0, 10) || null,
      shipping_address: requiredText(body.shippingAddress, '收件地址', 300),
      shipping_note: String(body.shippingNote || '').trim().slice(0, 500) || null,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      payment_method: paymentMethod === 'BARCODE' ? 'ECPAY_BARCODE' : 'ECPAY_CREDIT',
      payment_status: 'PENDING',
      order_status: 'PENDING_PAYMENT',
      ecpay_trade_no: merchantTradeNo
    }).select('id').single();
    if (orderError || !order) throw orderError || new Error('建立訂單失敗');
    orderId = order.id;

    const { error: itemError } = await supabase.from('physical_order_items').insert(
      orderItems.map(item => ({ ...item, order_id: order.id }))
    );
    if (itemError) throw itemError;

    const { merchantId, hashKey, hashIv, checkoutUrl } = getEcpayConfig();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const fields: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatEcpayTradeDate(),
      PaymentType: 'aio',
      TotalAmount: String(totalAmount),
      TradeDesc: 'FirstRoamLink physical products',
      ItemName: sanitizeEcpayText(orderItems.map(item => `${item.product_name}x${item.quantity}`).join('#'), 200),
      ReturnURL: `${origin}/api/ecpay/shop/notify`,
      ClientBackURL: paymentMethod === 'BARCODE' ? `${origin}/shop?payment=barcode` : `${origin}/shop?payment=cancelled`,
      ChoosePayment: paymentMethod,
      EncryptType: '1',
      Language: 'CHT',
      CustomField1: order.id,
      CustomField2: 'PHYSICAL'
    };
    if (paymentMethod === 'BARCODE') fields.StoreExpireDate = '3';
    else fields.OrderResultURL = `${origin}/api/ecpay/shop/result`;
    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);

    return NextResponse.json({ action: checkoutUrl, fields, orderId: order.id });
  } catch (error) {
    if (orderId) {
      try {
        await getPhysicalStoreAdmin().from('physical_orders').delete().eq('id', orderId).eq('payment_status', 'PENDING');
      } catch (cleanupError) {
        console.error('Failed to clean up physical order:', cleanupError);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : '建立付款失敗' }, { status: 400 });
  }
}
