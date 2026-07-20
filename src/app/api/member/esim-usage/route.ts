import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchMicroesimTopupDetail } from '@/lib/microesim';
import { authenticationErrorResponse, requireAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type AnyRecord = Record<string, unknown>;

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findFirstValue(source: unknown, keys: string[], depth = 0): unknown {
  if (!source || depth > 5) return undefined;
  const wanted = new Set(keys.map(normalizeKey));

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findFirstValue(item, keys, depth + 1);
      if (found !== undefined && found !== null && found !== '') return found;
    }
    return undefined;
  }

  if (typeof source === 'object') {
    const record = source as AnyRecord;
    for (const [key, value] of Object.entries(record)) {
      if (wanted.has(normalizeKey(key)) && value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    for (const value of Object.values(record)) {
      const found = findFirstValue(value, keys, depth + 1);
      if (found !== undefined && found !== null && found !== '') return found;
    }
  }

  return undefined;
}

function stringifyValue(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeDate(value: unknown) {
  const text = stringifyValue(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString();
}

function normalizeMicroesimUsage(detail: AnyRecord, fallbackExpiryDate?: string | null) {
  const status = stringifyValue(findFirstValue(detail, [
    'status',
    'esim_status',
    'esimStatus',
    'active_status',
    'activeStatus',
    'install_status',
    'installStatus'
  ]));
  const usedData = stringifyValue(findFirstValue(detail, [
    'used_data',
    'usedData',
    'usage',
    'used',
    'used_flow',
    'usedFlow'
  ]));
  const remainingData = stringifyValue(findFirstValue(detail, [
    'remaining_data',
    'remainingData',
    'remain_data',
    'remainData',
    'available_data',
    'availableData',
    'left_data',
    'leftData'
  ]));
  const totalData = stringifyValue(findFirstValue(detail, [
    'total_data',
    'totalData',
    'data_total',
    'dataTotal',
    'data'
  ]));
  const activatedAt = normalizeDate(findFirstValue(detail, [
    'active_time',
    'activeTime',
    'activated_at',
    'activatedAt',
    'start_time',
    'startTime'
  ]));
  const expiresAt = normalizeDate(findFirstValue(detail, [
    'expire_time',
    'expireTime',
    'expired_time',
    'expiredTime',
    'end_time',
    'endTime',
    'expiry_date',
    'expiryDate'
  ])) || fallbackExpiryDate || null;

  return {
    status,
    usedData,
    remainingData,
    totalData,
    activatedAt,
    expiresAt,
    raw: detail
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { order_item_id } = await request.json();
    const email = user.email.toLowerCase();

    if (!order_item_id) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (!customer) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select(`
        id,
        inventory_id,
        orders!inner(customer_id, payment_status),
        e_sim_inventory (
          id,
          expiry_date,
          microesim_topup_id,
          microesim_usage_cache,
          microesim_usage_checked_at
        )
      `)
      .eq('id', order_item_id)
      .single();

    const orderRecord = (item as any)?.orders;
    const order = Array.isArray(orderRecord) ? orderRecord[0] : orderRecord;
    const inventoryRecord = (item as any)?.e_sim_inventory;
    const inventory = Array.isArray(inventoryRecord) ? inventoryRecord[0] : inventoryRecord;

    if (itemError || !item || order?.customer_id !== customer.id || order?.payment_status !== 'PAID') {
      return NextResponse.json({ error: '無權限查詢此 eSIM' }, { status: 403 });
    }

    if (!inventory?.microesim_topup_id) {
      return NextResponse.json({
        error: '這張 eSIM 沒有 MicroEsim 查詢編號，可能是手動庫存或舊訂單'
      }, { status: 400 });
    }

    try {
      const detail = await fetchMicroesimTopupDetail(inventory.microesim_topup_id);
      const usage = normalizeMicroesimUsage(detail as AnyRecord, inventory.expiry_date);

      await supabase
        .from('e_sim_inventory')
        .update({
          microesim_usage_cache: usage,
          microesim_usage_checked_at: new Date().toISOString()
        })
        .eq('id', inventory.id);

      return NextResponse.json({
        success: true,
        usage,
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      if (inventory.microesim_usage_cache) {
        return NextResponse.json({
          success: true,
          stale: true,
          usage: inventory.microesim_usage_cache,
          checkedAt: inventory.microesim_usage_checked_at,
          warning: error instanceof Error ? error.message : 'MicroEsim 查詢暫時失敗'
        });
      }
      throw error;
    }
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('MicroEsim usage query failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '查詢 eSIM 用量失敗'
    }, { status: 500 });
  }
}
