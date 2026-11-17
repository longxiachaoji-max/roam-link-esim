import { after, NextResponse } from 'next/server';
import { authenticationErrorResponse, getServerSupabase, requireAuthenticatedUser } from '@/lib/server-auth';
import { reconcilePendingMicroesimItems } from '@/lib/microesim-fulfillment';
import {
  DashboardAccessError,
  findCustomerByEmail,
  listDashboards,
  normalizeMemberEmail,
  resolveDashboardRole
} from '@/lib/esim-dashboard';

export const dynamic = 'force-dynamic';

const MAX_MEMBERS = 30;
const MAX_CATEGORIES = 50;
const MAX_CATEGORY_NAME = 30;

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
  user_deleted_at: string | null;
  products: Relation<{ name: string | null; country: string | null }>;
  e_sim_inventory: Relation<InventoryRow>;
}

interface OrderRow {
  order_number: string | null;
  order_items: ItemRow[];
}

function safeInstallLink(value: unknown) {
  const link = String(value || '').trim();
  return /^(https:\/\/|intent:|lpa:)/i.test(link) ? link : null;
}

async function viewerContext(request: Request) {
  const user = await requireAuthenticatedUser(request);
  const email = user.email.toLowerCase();
  const supabase = getServerSupabase();
  const customer = await findCustomerByEmail(supabase, email);
  return { supabase, email, customer };
}

function errorResponse(error: unknown, fallback: string) {
  const authError = authenticationErrorResponse(error);
  if (authError) return authError;
  if (error instanceof DashboardAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// GET /api/member/esim-dashboard?owner=<customerId>
export async function GET(request: Request) {
  try {
    const { supabase, email, customer } = await viewerContext(request);
    const dashboards = await listDashboards(supabase, email, customer?.id || null);
    const requestedOwner = new URL(request.url).searchParams.get('owner') || '';
    const ownerId = requestedOwner || dashboards[0]?.ownerId || '';
    if (!ownerId) {
      return NextResponse.json({ dashboards, ownerId: null, role: 'owner', cards: [], categories: [], members: [], balance: null });
    }
    const role = await resolveDashboardRole(supabase, email, customer?.id || null, ownerId);

    after(async () => {
      try {
        await reconcilePendingMicroesimItems(supabase, { customerId: ownerId, limit: 10, minAgeSeconds: 10 });
      } catch (reconcileError) {
        console.error('Dashboard MicroEsim reconciliation failed:', reconcileError);
      }
    });

    const [ordersResult, categoriesResult, assignmentsResult, membersResult] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          order_number,
          order_items (
            id, note, user_deleted_at,
            products ( name, country ),
            e_sim_inventory (
              iccid, smdp_address, activation_code, ios_install_url, android_install_url,
              microesim_topup_id, microesim_usage_cache, microesim_usage_checked_at
            )
          )
        `)
        .eq('customer_id', ownerId)
        .eq('payment_status', 'PAID')
        .neq('payment_method', 'ECPAY_TOPUP')
        .order('created_at', { ascending: false }),
      supabase.from('esim_card_categories').select('id, name, sort_order').eq('owner_customer_id', ownerId).order('sort_order').order('created_at'),
      supabase.from('esim_card_category_items').select('order_item_id, category_id').eq('owner_customer_id', ownerId),
      role === 'owner'
        ? supabase.from('esim_dashboard_members').select('member_email, created_at').eq('owner_customer_id', ownerId).order('created_at')
        : Promise.resolve({ data: [], error: null })
    ]);
    if (ordersResult.error) throw ordersResult.error;
    const sharingReady = !categoriesResult.error && !assignmentsResult.error;

    const assignments = new Map<string, string>();
    for (const row of (assignmentsResult.data || []) as { order_item_id: string; category_id: string }[]) {
      assignments.set(row.order_item_id, row.category_id);
    }

    const showInstall = role === 'owner';
    const cards = ((ordersResult.data || []) as unknown as OrderRow[]).flatMap(order => (order.order_items || [])
      .filter(item => !item.user_deleted_at)
      .map(item => {
        const inventory = first(item.e_sim_inventory);
        const product = first(item.products);
        return {
          id: item.id,
          orderNumber: order.order_number || '',
          note: item.note || '',
          planName: product?.name || 'eSIM 方案',
          country: product?.country || '',
          iccid: inventory?.iccid || null,
          smdpAddress: showInstall ? inventory?.smdp_address || null : null,
          activationCode: showInstall ? inventory?.activation_code || null : null,
          iosInstallUrl: showInstall ? safeInstallLink(inventory?.ios_install_url) : null,
          androidInstallUrl: showInstall ? safeInstallLink(inventory?.android_install_url) : null,
          canQueryUsage: Boolean(inventory?.microesim_topup_id && inventory?.iccid),
          usage: inventory?.microesim_usage_cache || null,
          usageCheckedAt: inventory?.microesim_usage_checked_at || null,
          pending: !inventory,
          categoryId: assignments.get(item.id) || null
        };
      }));

    const balance = role === 'owner' && customer ? Number(customer.token_balance) : null;
    return NextResponse.json({
      dashboards,
      ownerId,
      role,
      sharingReady,
      cards,
      categories: categoriesResult.data || [],
      members: (membersResult.data || []).map(row => (row as { member_email: string }).member_email),
      balance: Number.isFinite(balance) ? balance : null
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, '讀取 eSIM 管理頁失敗');
  }
}

// POST /api/member/esim-dashboard  { owner, action, ... }
export async function POST(request: Request) {
  try {
    const { supabase, email, customer } = await viewerContext(request);
    const body = await request.json().catch(() => ({}));
    const ownerId = String(body.owner || '');
    const action = String(body.action || '');
    if (!ownerId) return NextResponse.json({ error: '缺少管理頁' }, { status: 400 });
    const role = await resolveDashboardRole(supabase, email, customer?.id || null, ownerId);

    if (action === 'add_member' || action === 'remove_member') {
      if (role !== 'owner') return NextResponse.json({ error: '只有擁有者可以管理共享群組' }, { status: 403 });
      const memberEmail = normalizeMemberEmail(body.email);
      if (!memberEmail) return NextResponse.json({ error: '請輸入正確的 Email' }, { status: 400 });
      if (action === 'remove_member') {
        const { error } = await supabase.from('esim_dashboard_members').delete().eq('owner_customer_id', ownerId).eq('member_email', memberEmail);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (memberEmail === email) return NextResponse.json({ error: '不需要加入自己' }, { status: 400 });
      const { count } = await supabase.from('esim_dashboard_members').select('id', { count: 'exact', head: true }).eq('owner_customer_id', ownerId);
      if ((count || 0) >= MAX_MEMBERS) return NextResponse.json({ error: `共享群組最多 ${MAX_MEMBERS} 人` }, { status: 400 });
      const { error } = await supabase.from('esim_dashboard_members').upsert(
        { owner_customer_id: ownerId, member_email: memberEmail },
        { onConflict: 'owner_customer_id,member_email', ignoreDuplicates: true }
      );
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'create_category' || action === 'rename_category') {
      const name = String(body.name || '').trim().slice(0, MAX_CATEGORY_NAME);
      if (!name) return NextResponse.json({ error: '請輸入分類名稱' }, { status: 400 });
      if (action === 'rename_category') {
        const { error } = await supabase.from('esim_card_categories').update({ name }).eq('id', String(body.id || '')).eq('owner_customer_id', ownerId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      const { data: existing } = await supabase.from('esim_card_categories').select('sort_order').eq('owner_customer_id', ownerId);
      if ((existing || []).length >= MAX_CATEGORIES) return NextResponse.json({ error: `分類最多 ${MAX_CATEGORIES} 個` }, { status: 400 });
      const nextOrder = Math.max(0, ...(existing || []).map(row => Number((row as { sort_order: number }).sort_order) || 0)) + 1;
      const { data, error } = await supabase.from('esim_card_categories')
        .insert({ owner_customer_id: ownerId, name, sort_order: nextOrder })
        .select('id, name, sort_order')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, category: data });
    }

    if (action === 'delete_category') {
      // 刪除分類：卡片回到「未分類」（關聯資料隨分類一起刪除）
      const { error } = await supabase.from('esim_card_categories').delete().eq('id', String(body.id || '')).eq('owner_customer_id', ownerId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'reorder_categories') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, MAX_CATEGORIES) : [];
      await Promise.all(ids.map((id: string, index: number) =>
        supabase.from('esim_card_categories').update({ sort_order: index + 1 }).eq('id', id).eq('owner_customer_id', ownerId)));
      return NextResponse.json({ success: true });
    }

    if (action === 'move_cards') {
      const itemIds: string[] = Array.isArray(body.order_item_ids) ? body.order_item_ids.map(String).slice(0, 500) : [];
      const categoryId = body.category_id ? String(body.category_id) : null;
      if (!itemIds.length) return NextResponse.json({ error: '請選擇要移動的 eSIM' }, { status: 400 });

      // 只允許移動這位擁有者的卡片
      const { data: owned, error: ownedError } = await supabase
        .from('order_items')
        .select('id, orders!inner(customer_id)')
        .in('id', itemIds)
        .eq('orders.customer_id', ownerId);
      if (ownedError) throw ownedError;
      const allowedIds = (owned || []).map(row => (row as { id: string }).id);
      if (!allowedIds.length) return NextResponse.json({ error: '找不到可移動的 eSIM' }, { status: 400 });

      if (!categoryId) {
        const { error } = await supabase.from('esim_card_category_items').delete().in('order_item_id', allowedIds).eq('owner_customer_id', ownerId);
        if (error) throw error;
        return NextResponse.json({ success: true, moved: allowedIds.length });
      }
      const { data: category } = await supabase.from('esim_card_categories').select('id').eq('id', categoryId).eq('owner_customer_id', ownerId).maybeSingle();
      if (!category) return NextResponse.json({ error: '分類不存在' }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await supabase.from('esim_card_category_items').upsert(
        allowedIds.map(id => ({ order_item_id: id, category_id: categoryId, owner_customer_id: ownerId, updated_at: now })),
        { onConflict: 'order_item_id' }
      );
      if (error) throw error;
      return NextResponse.json({ success: true, moved: allowedIds.length });
    }

    return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'eSIM 管理頁操作失敗');
  }
}
