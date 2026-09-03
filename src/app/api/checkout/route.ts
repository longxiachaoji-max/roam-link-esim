import { after, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { isDealerReferralDiscount, isPromoDiscount, resolveCheckoutDiscount, type CheckoutDiscountQuote } from '@/lib/checkout-discounts';
import { recordDealerReferralCommission } from '@/lib/dealer-referrals';
import { fulfillMicroesimOrderItem } from '@/lib/microesim-fulfillment';
import { sendMicroesimFulfillmentFailureAlert } from '@/lib/order-alerts';
import { sendCustomerEsimDeliveryEmail } from '@/lib/customer-esim-delivery-email';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { parseTokenCheckoutRequest, TokenCheckoutRequestError } from '@/lib/token-checkout';

export const maxDuration = 300;

const NOTIFICATION_CONFIG_PATTERN = /\n?<!--NOTIFICATION_SETTINGS:([\s\S]*?)-->\n?/;

interface NotificationSettings {
  notify_email_enabled: boolean;
  order_notify_email: string;
  notify_telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

function getFallbackNotificationSettings(): NotificationSettings {
  return {
    notify_email_enabled: Boolean(process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL),
    order_notify_email: process.env.ORDER_NOTIFY_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || '',
    notify_telegram_enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || ''
  };
}

function parseNotificationConfig(usageGuide: string | null): Partial<NotificationSettings> {
  const match = (usageGuide || '').match(NOTIFICATION_CONFIG_PATTERN);
  if (!match?.[1]) return {};

  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

async function getNotificationSettings(): Promise<NotificationSettings> {
  const fallback = getFallbackNotificationSettings();

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('site_settings')
      .select('usage_guide')
      .eq('id', 'main')
      .single();

    if (error || !data) return fallback;
    const config = parseNotificationConfig(data.usage_guide);

    return {
      notify_email_enabled: config.notify_email_enabled ?? fallback.notify_email_enabled,
      order_notify_email: config.order_notify_email || fallback.order_notify_email,
      notify_telegram_enabled: config.notify_telegram_enabled ?? fallback.notify_telegram_enabled,
      telegram_bot_token: config.telegram_bot_token || fallback.telegram_bot_token,
      telegram_chat_id: config.telegram_chat_id || fallback.telegram_chat_id
    };
  } catch {
    return fallback;
  }
}

async function sendTelegramNotification(message: string, token: string, chatId: string) {
  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to send Telegram notification:', text);
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser(request);
    const supabase = getServerSupabase();
    const body = await request.json();
    const { name, productIds, discountCode } = parseTokenCheckoutRequest(body);
    const effectiveDiscountCode = discountCode || String(authUser.user_metadata?.referral_code || '').trim();
    const email = authUser.email.toLowerCase();

    // 1. Get or create customer
    const customerResult = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();
    let customer = customerResult.data;
    const customerError = customerResult.error;

    if (customerError && customerError.code !== 'PGRST116') {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
    }

    if (!customer) {
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([{ email, name, token_balance: 0 }])
        .select()
        .single();
      
      if (createError) throw createError;
      customer = newCustomer;
    }

    // 2. Read the complete cart again on the server. Repeated IDs represent quantity.
    const uniqueProductIds = [...new Set(productIds)];
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('*')
      .in('id', uniqueProductIds);

    if (productError) throw productError;
    const productMap = new Map((productRows || []).map(product => [product.id, product]));
    const products = productIds.map(id => productMap.get(id)).filter(Boolean);
    if (products.length !== productIds.length || products.some(product => !product.is_active)) {
      return NextResponse.json({ error: '部分商品已下架，請重新整理購物車' }, { status: 400 });
    }

    // 3. Calculate the discount once for the whole cart.
    const originalTotalAmount = products.reduce((sum, product) => sum + Math.round(Number(product.price)), 0);
    let discountQuote: CheckoutDiscountQuote | null = null;

    if (effectiveDiscountCode) {
      discountQuote = await resolveCheckoutDiscount(supabase, email, effectiveDiscountCode, originalTotalAmount);
    }
    const tokensUsed = discountQuote?.payableTotal ?? originalTotalAmount;

    if (!customer.token_balance || customer.token_balance < tokensUsed) {
      return NextResponse.json({ error: '請儲值後結帳' }, { status: 400 });
    }

    // 4. Keep the cart order, balance deduction, ledger and coupon usage in one transaction.
    const { data: checkoutRows, error: checkoutError } = await supabase.rpc('create_atomic_token_cart_checkout', {
      p_customer_id: customer.id,
      p_product_ids: productIds,
      p_payable_tokens: tokensUsed,
      p_original_total: originalTotalAmount,
      p_discount_amount: discountQuote?.discountAmount || 0,
      p_promo_code_id: isPromoDiscount(discountQuote) ? discountQuote.promoCodeId : null
    });
    if (checkoutError || !checkoutRows?.[0]) {
      if (checkoutError?.message.includes('INSUFFICIENT_BALANCE')) {
        return NextResponse.json({ error: '儲值金餘額不足，請重新整理後再試' }, { status: 400 });
      }
      if (checkoutError?.message.includes('PROMO_')) {
        return NextResponse.json({ error: '優惠碼狀態已變更，請重新套用後再結帳' }, { status: 400 });
      }
      throw checkoutError || new Error('建立儲值金訂單失敗');
    }
    const checkout = checkoutRows[0];
    const order = {
      id: checkout.order_id,
      order_number: checkout.order_number,
      total_amount: 0,
      tokens_used: tokensUsed,
      payment_status: 'PAID',
      order_status: 'PENDING'
    };
    customer.token_balance = checkout.new_balance;

    if (isDealerReferralDiscount(discountQuote)) {
      await recordDealerReferralCommission(supabase, order.id, discountQuote, products.length, true);
    }

    // The payment is already complete. Fulfillment can take minutes when several
    // supplier eSIMs are purchased, so keep it out of the customer response.
    after(async () => {
      try {
        // 5. Claim inventory or ask the supplier to fulfill each paid item.
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('order_items')
          .select('id, product_id')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });
        if (orderItemsError) throw orderItemsError;

        const pendingProducts: typeof products = [];
        const items = orderItems || [];
        for (let start = 0; start < items.length; start += 3) {
          const batchPendingProducts = await Promise.all(items.slice(start, start + 3).map(async orderItem => {
            const product = productMap.get(orderItem.product_id);
            if (!product) return null;
            let fulfilled = false;

            const { data: inventoryCandidates } = await supabase
              .from('e_sim_inventory')
              .select('id')
              .eq('product_id', product.id)
              .eq('status', 'AVAILABLE')
              .limit(3);
            for (const candidate of inventoryCandidates || []) {
              const { data: claimedInventory, error: claimError } = await supabase
                .from('e_sim_inventory')
                .update({ status: 'SOLD', sold_at: new Date().toISOString() })
                .eq('id', candidate.id)
                .eq('status', 'AVAILABLE')
                .select('id')
                .maybeSingle();
              if (claimError) throw claimError;
              if (!claimedInventory) continue;

              const { data: boundItem, error: bindError } = await supabase
                .from('order_items')
                .update({ inventory_id: claimedInventory.id })
                .eq('id', orderItem.id)
                .is('inventory_id', null)
                .select('id')
                .maybeSingle();
              if (bindError) throw bindError;
              if (boundItem) {
                fulfilled = true;
                break;
              }
              await supabase.from('e_sim_inventory').update({ status: 'AVAILABLE', sold_at: null }).eq('id', candidate.id);
            }

            if (!fulfilled) {
              try {
                fulfilled = Boolean(await fulfillMicroesimOrderItem(supabase, orderItem.id, product.id, product));
              } catch (microError) {
                console.error('MicroEsim token checkout fulfillment failed:', {
                  productId: product.id,
                  supplierPlanId: product.supplier_plan_id,
                  error: microError
                });
                await sendMicroesimFulfillmentFailureAlert(supabase, {
                  source: '儲值金結帳自動配發',
                  orderId: order.id,
                  orderItemId: orderItem.id,
                  customerEmail: email,
                  productName: product.name,
                  country: product.country,
                  validityDays: product.validity_days,
                  supplierPlanId: product.supplier_plan_id,
                  error: microError
                });
              }
            }
            return fulfilled ? null : product;
          }));

          for (const pendingProduct of batchPendingProducts) {
            if (pendingProduct) pendingProducts.push(pendingProduct);
          }
        }

        const fullyAssigned = pendingProducts.length === 0;
        await supabase
          .from('orders')
          .update({ order_status: fullyAssigned ? 'COMPLETED' : 'PENDING', updated_at: new Date().toISOString() })
          .eq('id', order.id);

        // 6. Notify the customer only after every eSIM is ready. Pending alerts remain admin-only.
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://roma-link-esim.vercel.app'}/admin/orders`;
        try {
          if (fullyAssigned) {
            await sendCustomerEsimDeliveryEmail(supabase, order.id);
          }

          const notificationSettings = !fullyAssigned ? await getNotificationSettings() : null;
          const notifyEmail = notificationSettings?.order_notify_email || '';
          if (!fullyAssigned && notificationSettings?.notify_email_enabled && notifyEmail) {
            const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
            await resend.emails.send({
              from: `一飛通全球漫遊 FirstRoamLink <${fromEmail}>`,
              to: [notifyEmail],
              subject: `待補 eSIM 訂單：${pendingProducts.map(product => product.name).join('、')}`,
              html: `
                <h1>有一筆訂單需要補 eSIM</h1>
                <p><strong>訂單：</strong>${order.order_number || order.id}</p>
                <p><strong>客戶：</strong>${email}</p>
                <p><strong>商品：</strong>${pendingProducts.map(product => product.name).join('、')}</p>
                <p><strong>實付：</strong>NT$${tokensUsed}</p>
                <p>請到後台訂單管理補上 eSIM 資料。</p>
              `,
            });
          }
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
          // The order remains valid even if a notification cannot be sent.
        }

        if (!fullyAssigned) {
          const notificationSettings = await getNotificationSettings();
          if (notificationSettings.notify_telegram_enabled) {
            await sendTelegramNotification([
              '<b>有一筆訂單需要補 eSIM</b>',
              `訂單：<code>${escapeTelegramHtml(order.order_number || order.id)}</code>`,
              `客戶：${escapeTelegramHtml(email)}`,
              `商品：${escapeTelegramHtml(pendingProducts.map(product => product.name).join('、'))}`,
              `實付：NT$${tokensUsed}`,
              `後台：${adminUrl}`
            ].join('\n'), notificationSettings.telegram_bot_token, notificationSettings.telegram_chat_id);
          }
        }
      } catch (fulfillmentError) {
        console.error('Token checkout background fulfillment failed:', {
          orderId: order.id,
          error: fulfillmentError
        });
      }
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      inventoryStatus: 'PENDING',
      message: 'Checkout successful, eSIM fulfillment started.',
    });

  } catch (error: unknown) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    if (error instanceof TokenCheckoutRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
