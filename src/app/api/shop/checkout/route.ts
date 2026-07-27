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
import { calculateRentalPrice, normalizeRentalPriceTiers } from '@/lib/rental-pricing';
import { sendPhysicalRentalOrderCreatedAlert } from '@/lib/physical-rental-alerts';
import {
  calculatePhysicalShippingFee,
  normalizePhysicalStoreSettings,
  type DeliveryMethod
} from '@/lib/physical-store-settings';

export const dynamic = 'force-dynamic';

type PaymentMethod = 'Credit' | 'BARCODE' | 'TOKENS';

interface CheckoutItem {
  productId: string;
  quantity: number;
  rentalStartDate?: string;
  rentalEndDate?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateToUtc(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function taipeiToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
    if (paymentMethod !== 'Credit' && paymentMethod !== 'BARCODE' && paymentMethod !== 'TOKENS') {
      return NextResponse.json({ error: '不支援的付款方式' }, { status: 400 });
    }
    const deliveryMethod = String(body.deliveryMethod || 'shipping') as DeliveryMethod;
    if (deliveryMethod !== 'shipping' && deliveryMethod !== 'pickup') {
      return NextResponse.json({ error: '配送方式不正確' }, { status: 400 });
    }

    const { data: rawStoreSettings, error: storeSettingsError } = await supabase
      .from('physical_store_settings')
      .select('*')
      .eq('id', 'main')
      .single();
    if (storeSettingsError) throw storeSettingsError;
    const storeSettings = normalizePhysicalStoreSettings(rawStoreSettings);
    if (deliveryMethod === 'pickup' && !storeSettings.pickup_enabled) throw new Error('目前未開放面交，請選擇宅配');

    const rawItems: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 20) throw new Error('購物車內容不正確');
    for (const item of rawItems) {
      const productId = String(item.productId || '');
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('商品數量不正確');
    }

    const productIds = [...new Set(rawItems.map(item => String(item.productId || '')))];
    const { data: products, error: productError } = await supabase
      .from('physical_products')
      .select('id, name, category, price, rental_price_tiers, rental_free_shipping_days, stock_quantity, images, is_active')
      .in('id', productIds)
      .eq('is_active', true);
    if (productError) throw productError;
    if ((products || []).length !== productIds.length) throw new Error('部分商品已下架，請重新整理購物車');

    const productsById = new Map((products || []).map(product => [product.id, product]));
    const nonRentalQuantities = new Map<string, number>();
    const rentalProductIds = new Set<string>();
    const today = taipeiToday();
    const orderItems = rawItems.map(item => {
      const product = productsById.get(String(item.productId));
      if (!product) throw new Error('部分商品已下架，請重新整理購物車');
      const quantity = Number(item.quantity);
      let rentalStartDate: string | null = null;
      let rentalEndDate: string | null = null;
      let rentalDays: number | null = null;
      let unitPrice = Math.round(Number(product.price));

      if (product.category === 'rental') {
        if (rentalProductIds.has(product.id)) throw new Error(`${product.name} 一次只能選擇一組租借日期`);
        rentalProductIds.add(product.id);
        rentalStartDate = String(item.rentalStartDate || '');
        rentalEndDate = String(item.rentalEndDate || '');
        if (!DATE_PATTERN.test(rentalStartDate) || !DATE_PATTERN.test(rentalEndDate)) throw new Error(`${product.name} 請先選擇租借日期`);
        const start = dateToUtc(rentalStartDate);
        const end = dateToUtc(rentalEndDate);
        if (!start || !end || rentalStartDate < today || end < start) throw new Error(`${product.name} 的租借日期不正確`);
        rentalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
        if (rentalDays < 1 || rentalDays > 365) throw new Error('單次租期需介於 1 至 365 天');
        unitPrice = calculateRentalPrice(unitPrice, rentalDays, normalizeRentalPriceTiers(product.rental_price_tiers));
      } else {
        nonRentalQuantities.set(product.id, (nonRentalQuantities.get(product.id) || 0) + quantity);
      }

      return {
        product_id: product.id,
        product_name: product.name,
        product_image: Array.isArray(product.images) ? product.images[0] || null : null,
        quantity,
        unit_price: unitPrice,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate,
        rental_days: rentalDays,
        rental_free_shipping_days: Number(product.rental_free_shipping_days) > 0
          ? Number(product.rental_free_shipping_days)
          : null
      };
    });
    for (const [productId, quantity] of nonRentalQuantities) {
      const product = productsById.get(productId);
      if (!product || Number(product.stock_quantity) < quantity) throw new Error(`${product?.name || '商品'} 庫存不足`);
    }
    const subtotal = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const hasRental = orderItems.some(item => item.rental_days !== null);
    if (hasRental && paymentMethod === 'BARCODE') {
      throw new Error('租借商品不開放超商條碼直接結帳。如需現金付款，請先儲值至超商繳款後，再以儲值金結帳');
    }
    const shippingFee = calculatePhysicalShippingFee(
      subtotal,
      orderItems.filter(item => item.rental_days !== null).map(item => ({
        days: Number(item.rental_days),
        freeShippingDays: item.rental_free_shipping_days
      })),
      deliveryMethod,
      storeSettings
    );
    const totalAmount = subtotal + shippingFee;
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) throw new Error('訂單金額不正確');

    if (paymentMethod !== 'TOKENS') {
      const { data: settings } = await supabase.from('site_settings').select('usage_guide').eq('id', 'main').single();
      const limits = parsePaymentLimits(settings?.usage_guide);
      const limit = paymentMethod === 'BARCODE'
        ? { min: limits.barcode_min, max: limits.barcode_max, label: '超商條碼付款' }
        : { min: limits.credit_min, max: limits.credit_max, label: '信用卡付款' };
      if (totalAmount < limit.min || totalAmount > limit.max) {
        throw new Error(`${limit.label}金額需介於 NT$${limit.min.toLocaleString()} 至 NT$${limit.max.toLocaleString()}`);
      }
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

    const merchantTradeNo = paymentMethod === 'TOKENS' ? '' : createMerchantTradeNo();
    const reservationExpiresAt = paymentMethod === 'TOKENS' ? null : new Date(Date.now() + (paymentMethod === 'BARCODE' ? 3 * 24 * 60 : 30) * 60_000).toISOString();
    const { data: createdOrderId, error: orderError } = await supabase.rpc('create_physical_order_with_items', {
      p_order: {
        customer_id: customer.id,
        customer_email: authUser.email,
        recipient_name: requiredText(body.recipientName, '收件人姓名', 80),
        recipient_phone: requiredText(body.recipientPhone, '聯絡電話', 30),
        postal_code: deliveryMethod === 'shipping' ? String(body.postalCode || '').trim().slice(0, 10) : '',
        shipping_address: deliveryMethod === 'shipping'
          ? requiredText(body.shippingAddress, '收件地址', 300)
          : storeSettings.pickup_label,
        shipping_note: String(body.shippingNote || '').trim().slice(0, 500),
        delivery_method: deliveryMethod,
        subtotal,
        shipping_fee: shippingFee,
        payment_method: paymentMethod === 'TOKENS' ? 'TOKENS' : paymentMethod === 'BARCODE' ? 'ECPAY_BARCODE' : 'ECPAY_CREDIT',
        ecpay_trade_no: merchantTradeNo,
        reservation_expires_at: reservationExpiresAt
      },
      p_items: orderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        rental_start_date: item.rental_start_date,
        rental_end_date: item.rental_end_date
      }))
    });
    if (orderError || !createdOrderId) throw orderError || new Error('建立訂單失敗');
    orderId = String(createdOrderId);

    if (paymentMethod === 'TOKENS') {
      await sendPhysicalRentalOrderCreatedAlert(supabase, orderId);
      const { data: updatedCustomer } = await supabase.from('customers').select('token_balance').eq('id', customer.id).maybeSingle();
      return NextResponse.json({ success: true, orderId, newBalance: Number(updatedCustomer?.token_balance ?? 0) });
    }

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
      CustomField1: orderId,
      CustomField2: 'PHYSICAL'
    };
    if (paymentMethod === 'BARCODE') fields.StoreExpireDate = '3';
    else fields.OrderResultURL = `${origin}/api/ecpay/shop/result`;
    fields.CheckMacValue = generateCheckMacValue(fields, hashKey, hashIv);

    return NextResponse.json({ action: checkoutUrl, fields, orderId });
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
