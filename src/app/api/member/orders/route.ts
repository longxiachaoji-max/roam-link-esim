import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcilePendingMicroesimItems } from '@/lib/microesim-fulfillment';
import { fetchMicroesimTopupDetail, getMicroesimInstallationDeadline } from '@/lib/microesim';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface MemberProductResult {
  id: string;
  name: string;
  country: string;
  data_amount: string | null;
  validity_days: number;
  supplier: string | null;
  supplier_raw: Record<string, unknown> | null;
}

interface MemberInventoryResult extends Record<string, unknown> {
  id: string;
  expiry_date: string | null;
  microesim_topup_id: string | null;
  ios_install_url: string | null;
  android_install_url: string | null;
}

function safeInstallLink(value: unknown) {
  const link = String(value || '').trim();
  return /^(https:\/\/|intent:|lpa:)/i.test(link) ? link : null;
}

interface MemberOrderItemResult extends Record<string, unknown> {
  products: MemberProductResult | MemberProductResult[] | null;
  e_sim_inventory: MemberInventoryResult | MemberInventoryResult[] | null;
  product_reviews: Record<string, unknown> | Record<string, unknown>[] | null;
}

interface MemberOrderResult extends Record<string, unknown> {
  created_at: string;
  order_items: MemberOrderItemResult[];
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const email = user.email.toLowerCase();
    // 1. Get customer
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ orders: [] }); // User might not have any orders yet
    }

    try {
      await reconcilePendingMicroesimItems(supabase, { customerId: customer.id, limit: 5, minAgeSeconds: 10 });
    } catch (reconcileError) {
      console.error('Member MicroEsim reconciliation failed:', reconcileError);
    }

    // 2. Get orders and join items, products, inventory
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at, 
        total_amount, 
        payment_status,
        order_status,
        order_items (
          id, 
          price,
          note,
          user_deleted_at,
          supplier_order_ref,
          supplier_order_id,
          supplier_status,
          supplier_last_checked_at,
          supplier_error,
          product_reviews (
            id,
            rating,
            smoothness_rating,
            comment,
            is_visible,
            created_at,
            updated_at
          ),
          products ( id, name, country, data_amount, validity_days, supplier, supplier_raw ),
          e_sim_inventory (
            id,
            iccid,
            smdp_address,
            activation_code,
            ios_install_url,
            android_install_url,
            status,
            expiry_date,
            microesim_topup_id,
            microesim_usage_cache,
            microesim_usage_checked_at
          )
        )
      `)
      .eq('customer_id', customer.id)
      .eq('payment_status', 'PAID')
      .neq('payment_method', 'ECPAY_TOPUP')
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    const missingInstallLinks = ((orders || []) as unknown as MemberOrderResult[])
      .flatMap(order => order.order_items || [])
      .map(item => Array.isArray(item.e_sim_inventory) ? item.e_sim_inventory[0] : item.e_sim_inventory)
      .filter((inventory): inventory is MemberInventoryResult => Boolean(
        inventory?.id
        && inventory.microesim_topup_id
        && (!inventory.ios_install_url || !inventory.android_install_url)
      ))
      .slice(0, 8);

    await Promise.allSettled(missingInstallLinks.map(async inventory => {
      const detail = await fetchMicroesimTopupDetail(inventory.microesim_topup_id!);
      const iosInstallUrl = safeInstallLink(detail.ios_esim_install_link?.[0]);
      const androidInstallUrl = safeInstallLink(detail.android_esim_install_link?.[0]);
      if (!iosInstallUrl && !androidInstallUrl) return;

      const updates = {
        ios_install_url: iosInstallUrl || inventory.ios_install_url,
        android_install_url: androidInstallUrl || inventory.android_install_url
      };
      const { error: installLinkError } = await supabase
        .from('e_sim_inventory')
        .update(updates)
        .eq('id', inventory.id);
      if (installLinkError) throw installLinkError;
      Object.assign(inventory, updates);
    }));

    const normalizedOrders = ((orders || []) as unknown as MemberOrderResult[]).map(order => ({
      ...order,
      order_items: (order.order_items || []).map(item => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        const inventory = Array.isArray(item.e_sim_inventory) ? item.e_sim_inventory[0] : item.e_sim_inventory;
        const review = Array.isArray(item.product_reviews) ? item.product_reviews[0] : item.product_reviews;
        const installationDeadline = inventory?.expiry_date
          || getMicroesimInstallationDeadline(product, null, order.created_at)
          || null;
        const publicProduct = product ? {
          id: product.id,
          name: product.name,
          country: product.country,
          data_amount: product.data_amount,
          validity_days: product.validity_days
        } : null;

        return {
          ...item,
          products: publicProduct,
          review: review || null,
          e_sim_inventory: inventory ? {
            ...inventory,
            installation_deadline: installationDeadline
          } : null
        };
      })
    }));

    return NextResponse.json({ orders: normalizedOrders });
  } catch (error: unknown) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取訂單失敗' }, { status: 500 });
  }
}
