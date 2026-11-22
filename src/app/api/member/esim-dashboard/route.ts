import { after, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { reconcilePendingMicroesimItems } from '@/lib/microesim-fulfillment';
import { sendEsimShareEmail } from '@/lib/esim-share-email';
import { ensureCustomer, findCustomerByEmail, normalizeMemberEmail } from '@/lib/esim-dashboard';
import { isValidEid, normalizeEid } from '@/lib/eid';

export const dynamic = 'force-dynamic';

const MAX_SHARE_EMAILS = 30;
const MAX_CATEGORIES = 50;
const MAX_CATEGORY_NAME = 30;
const MAX_ITEMS_PER_ACTION = 500;

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T> | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

interface InventoryRow {
  iccid: string | null;
  smdp_address: string | null;
  activation_code: string | null;
  ios_install_url: string | null;
  android_install_url: string | null;
  microesim_topup_id: string | null;
  microesim_usage_cache: Record<string, unknown> | null;
  microesim_usage_checked_at: string | null;
}

interface ItemRow {
  id: string;
  note: string | null;
  target_eid: string | null;
  user_deleted_at: string | null;
  products: Relation<{ name: string | null; country: string | null }>;
  e_sim_inventory: Relation<InventoryRow>;
  orders?: Relation<{ order_number: string | null; payment_status: string | null; customers: Relation<{ email: string | null }> }>;
}

interface OrderRow {
  order_number: string | null;
  order_items: ItemRow[];
}

const ITEM_FIELDS = `
  id, note, target_eid, user_deleted_at,
  products ( name, country ),
  e_sim_inventory (
    iccid, smdp_address, activation_code, ios_install_url, android_install_url,
    microesim_topup_id, microesim_usage_cache, microesim_usage_checked_at
  )`;

function safeInstallLink(value: unknown) {
  const link = String(value || '').trim();
  return /^(https:\/\/|intent:|lpa:)/i.test(link) ? link : null;
}

function toCard(item: ItemRow, orderNumber: string, extra: { sharedBy: string | null; sharedWith: string[]; categoryId: string | null }) {
  const inventory = first(item.e_sim_inventory);
  const product = first(item.products);
  return {
    id: item.id,
    orderNumber,
    note: item.note || '',
    targetEid: item.target_eid || null,
    planName: product?.name || 'eSIM 方案',
    country: product?.country || '',
    iccid: inventory?.iccid || null,
    smdpAddress: inventory?.smdp_address || null,
    activationCode: inventory?.activation_code || null,
    iosInstallUrl: safeInstallLink(inventory?.ios_install_url),
    androidInstallUrl: safeInstallLink(inventory?.android_install_url),
    canQueryUsage: Boolean(inventory?.microesim_topup_id && inventory?.iccid),
    usage: inventory?.microesim_usage_cache || null,
    usageCheckedAt: inventory?.microesim_usage_checked_at || null,
    pending: !inventory,
    ...extra
  };
}

function errorResponse(error: unknown, fallback: string) {
  const authError = authenticationErrorResponse(error);
  if (authError) return authError;
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// 只回傳屬於這位客戶（本人購買）的 order item id
async function ownedItemIds(supabase: SupabaseClient, customerId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('order_items')
    .select('id, orders!inner(customer_id)')
    .in('id', ids)
    .eq('orders.customer_id', customerId);
  if (error) throw error;
  return (data || []).map(row => (row as { id: string }).id);
}

// 本人購買的＋別人共享給我的
async function accessibleItemIds(supabase: SupabaseClient, customerId: string | null, email: string, ids: string[]) {
  if (!ids.length) return [];
  const owned = customerId ? await ownedItemIds(supabase, customerId, ids) : [];
  const { data: shared } = await supabase
    .from('esim_card_shares')
    .select('order_item_id')
    .in('order_item_id', ids)
    .eq('member_email', email);
  return [...new Set([...owned, ...(shared || []).map(row => (row as { order_item_id: string }).order_item_id)])];
}

// GET /api/member/esim-dashboard：我的 eSIM（自己買的＋共享給我的）
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const email = user.email.toLowerCase();
    const supabase = getServerSupabase();
    const customer = await findCustomerByEmail(supabase, email);

    if (customer) {
      after(async () => {
        try {
          await reconcilePendingMicroesimItems(supabase, { customerId: customer.id, limit: 10, minAgeSeconds: 10 });
        } catch (reconcileError) {
          console.error('Dashboard MicroEsim reconciliation failed:', reconcileError);
        }
      });
    }

    const [ordersResult, sharedResult, categoriesResult, assignmentsResult, outgoingResult] = await Promise.all([
      customer
        ? supabase
          .from('orders')
          .select(`order_number, order_items ( ${ITEM_FIELDS} )`)
          .eq('customer_id', customer.id)
          .eq('payment_status', 'PAID')
          .neq('payment_method', 'ECPAY_TOPUP')
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('esim_card_shares').select('order_item_id, created_at').eq('member_email', email).order('created_at', { ascending: false }),
      customer
        ? supabase.from('esim_card_categories').select('id, name, sort_order').eq('owner_customer_id', customer.id).order('sort_order').order('created_at')
        : Promise.resolve({ data: [], error: null }),
      customer
        ? supabase.from('esim_card_category_items').select('order_item_id, category_id').eq('owner_customer_id', customer.id)
        : Promise.resolve({ data: [], error: null }),
      customer
        ? supabase.from('esim_card_shares').select('order_item_id, member_email').eq('owner_customer_id', customer.id)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (ordersResult.error) throw ordersResult.error;
    const sharingReady = !sharedResult.error && !categoriesResult.error && !assignmentsResult.error && !outgoingResult.error;

    const assignments = new Map<string, string>();
    for (const row of (assignmentsResult.data || []) as { order_item_id: string; category_id: string }[]) {
      assignments.set(row.order_item_id, row.category_id);
    }
    const sharedWith = new Map<string, string[]>();
    for (const row of (outgoingResult.data || []) as { order_item_id: string; member_email: string }[]) {
      sharedWith.set(row.order_item_id, [...(sharedWith.get(row.order_item_id) || []), row.member_email]);
    }

    const ownCards = ((ordersResult.data || []) as unknown as OrderRow[]).flatMap(order => (order.order_items || [])
      .filter(item => !item.user_deleted_at)
      .map(item => toCard(item, order.order_number || '', {
        sharedBy: null,
        sharedWith: sharedWith.get(item.id) || [],
        categoryId: assignments.get(item.id) || null
      })));

    const ownIds = new Set(ownCards.map(card => card.id));
    const sharedIds = ((sharedResult.data || []) as { order_item_id: string }[])
      .map(row => row.order_item_id)
      .filter(id => !ownIds.has(id));
    let sharedCards: ReturnType<typeof toCard>[] = [];
    if (sharedIds.length) {
      const { data: sharedItems, error: sharedError } = await supabase
        .from('order_items')
        .select(`${ITEM_FIELDS}, orders!inner ( order_number, payment_status, customers ( email ) )`)
        .in('id', sharedIds);
      if (sharedError) throw sharedError;
      const order = new Map(sharedIds.map((id, index) => [id, index]));
      sharedCards = ((sharedItems || []) as unknown as ItemRow[])
        .filter(item => !item.user_deleted_at && first(item.orders)?.payment_status === 'PAID')
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map(item => {
          const orderRow = first(item.orders);
          return toCard(item, orderRow?.order_number || '', {
            sharedBy: first(orderRow?.customers ?? null)?.email || '其他會員',
            sharedWith: [],
            categoryId: assignments.get(item.id) || null
          });
        });
    }

    const balance = customer ? Number(customer.token_balance) : null;
    return NextResponse.json({
      sharingReady,
      cards: [...ownCards, ...sharedCards],
      categories: categoriesResult.data || [],
      balance: balance !== null && Number.isFinite(balance) ? balance : null
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, '讀取 eSIM 失敗');
  }
}

// POST /api/member/esim-dashboard  { action, ... }
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const email = user.email.toLowerCase();
    const supabase = getServerSupabase();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const itemIds: string[] = Array.isArray(body.order_item_ids) ? body.order_item_ids.map(String).slice(0, MAX_ITEMS_PER_ACTION) : [];

    // 指定安裝到哪張 eSIM 晶片（EID）：只有購買者本人可以設定；eid 空白 = 清除
    if (action === 'set_target_eid') {
      const customer = await findCustomerByEmail(supabase, email);
      if (!customer) return NextResponse.json({ error: '只能設定自己購買的 eSIM' }, { status: 403 });
      const eid = normalizeEid(body.eid);
      if (eid && !isValidEid(eid)) return NextResponse.json({ error: 'EID 格式不正確，請確認是 89 開頭的 32 位數字' }, { status: 400 });
      const allowed = await ownedItemIds(supabase, customer.id, itemIds);
      if (!allowed.length) return NextResponse.json({ error: '請選擇自己購買的 eSIM' }, { status: 400 });
      const { error } = await supabase.from('order_items').update({ target_eid: eid || null }).in('id', allowed);
      if (error) throw error;
      return NextResponse.json({ success: true, updated: allowed, eid: eid || null });
    }

    // 共享卡片：只有購買者本人可以操作
    if (action === 'share_cards' || action === 'unshare_cards') {
      const customer = await findCustomerByEmail(supabase, email);
      if (!customer) return NextResponse.json({ error: '只能共享自己購買的 eSIM' }, { status: 403 });
      const memberEmail = normalizeMemberEmail(body.email);
      if (!memberEmail) return NextResponse.json({ error: '請輸入正確的 Email' }, { status: 400 });
      const allowed = await ownedItemIds(supabase, customer.id, itemIds);
      if (!allowed.length) return NextResponse.json({ error: '請選擇自己購買的 eSIM' }, { status: 400 });

      if (action === 'unshare_cards') {
        const { error } = await supabase.from('esim_card_shares').delete().in('order_item_id', allowed).eq('member_email', memberEmail);
        if (error) throw error;
        return NextResponse.json({ success: true, count: allowed.length });
      }
      if (memberEmail === email) return NextResponse.json({ error: '不需要共享給自己' }, { status: 400 });
      const { data: existing } = await supabase.from('esim_card_shares').select('member_email').eq('owner_customer_id', customer.id);
      const emails = new Set((existing || []).map(row => (row as { member_email: string }).member_email));
      if (!emails.has(memberEmail) && emails.size >= MAX_SHARE_EMAILS) {
        return NextResponse.json({ error: `最多共享給 ${MAX_SHARE_EMAILS} 個 Email` }, { status: 400 });
      }
      const { data: inserted, error } = await supabase.from('esim_card_shares').upsert(
        allowed.map(id => ({ order_item_id: id, member_email: memberEmail, owner_customer_id: customer.id })),
        { onConflict: 'order_item_id,member_email', ignoreDuplicates: true }
      ).select('order_item_id');
      if (error) throw error;
      // 只通知這次新共享的卡，重複共享同一張不會再寄信
      const newItemIds = (inserted || []).map(row => (row as { order_item_id: string }).order_item_id);
      if (newItemIds.length) {
        after(async () => {
          try {
            await sendEsimShareEmail(supabase, { ownerEmail: email, memberEmail, orderItemIds: newItemIds });
          } catch (mailError) {
            console.error('eSIM share email failed:', mailError);
          }
        });
      }
      return NextResponse.json({ success: true, count: allowed.length, notified: newItemIds.length > 0 });
    }

    // 分類：每個人管理自己的分類（共享給我的卡也可以放進我的分類）
    const customer = await ensureCustomer(supabase, email);

    if (action === 'create_category' || action === 'rename_category') {
      const name = String(body.name || '').trim().slice(0, MAX_CATEGORY_NAME);
      if (!name) return NextResponse.json({ error: '請輸入分類名稱' }, { status: 400 });
      if (action === 'rename_category') {
        const { error } = await supabase.from('esim_card_categories').update({ name }).eq('id', String(body.id || '')).eq('owner_customer_id', customer.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      const { data: existing } = await supabase.from('esim_card_categories').select('sort_order').eq('owner_customer_id', customer.id);
      if ((existing || []).length >= MAX_CATEGORIES) return NextResponse.json({ error: `分類最多 ${MAX_CATEGORIES} 個` }, { status: 400 });
      const nextOrder = Math.max(0, ...(existing || []).map(row => Number((row as { sort_order: number }).sort_order) || 0)) + 1;
      const { data, error } = await supabase.from('esim_card_categories')
        .insert({ owner_customer_id: customer.id, name, sort_order: nextOrder })
        .select('id, name, sort_order')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, category: data });
    }

    if (action === 'delete_category') {
      const { error } = await supabase.from('esim_card_categories').delete().eq('id', String(body.id || '')).eq('owner_customer_id', customer.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'reorder_categories') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, MAX_CATEGORIES) : [];
      await Promise.all(ids.map((id: string, index: number) =>
        supabase.from('esim_card_categories').update({ sort_order: index + 1 }).eq('id', id).eq('owner_customer_id', customer.id)));
      return NextResponse.json({ success: true });
    }

    if (action === 'move_cards') {
      const categoryId = body.category_id ? String(body.category_id) : null;
      if (!itemIds.length) return NextResponse.json({ error: '請選擇要移動的 eSIM' }, { status: 400 });
      const allowed = await accessibleItemIds(supabase, customer.id, email, itemIds);
      if (!allowed.length) return NextResponse.json({ error: '找不到可移動的 eSIM' }, { status: 400 });

      if (!categoryId) {
        const { error } = await supabase.from('esim_card_category_items').delete().in('order_item_id', allowed).eq('owner_customer_id', customer.id);
        if (error) throw error;
        return NextResponse.json({ success: true, moved: allowed.length });
      }
      const { data: category } = await supabase.from('esim_card_categories').select('id').eq('id', categoryId).eq('owner_customer_id', customer.id).maybeSingle();
      if (!category) return NextResponse.json({ error: '分類不存在' }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await supabase.from('esim_card_category_items').upsert(
        allowed.map(id => ({ order_item_id: id, category_id: categoryId, owner_customer_id: customer.id, updated_at: now })),
        { onConflict: 'owner_customer_id,order_item_id' }
      );
      if (error) throw error;
      return NextResponse.json({ success: true, moved: allowed.length });
    }

    return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'eSIM 操作失敗');
  }
}
