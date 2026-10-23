import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminApiGuard, getServerSupabase } from '@/lib/server-auth';
import {
  normalizeSupplierTopupInput,
  parseSupplierTopups,
  summarizeSupplierTopups,
  withSupplierTopups,
  type SupplierTopup
} from '@/lib/supplier-topups';

export const dynamic = 'force-dynamic';

async function readSettings() {
  const { data, error } = await getServerSupabase()
    .from('site_settings')
    .select('usage_guide, updated_at')
    .eq('id', 'main')
    .single();
  if (error) throw error;
  return { usageGuide: data?.usage_guide || '', updatedAt: data?.updated_at as string | null };
}

// 其他功能（推薦碼、付款限制等）也會寫同一欄；只在資料沒被別人改過時寫入，否則重讀重試
async function updateRecords(change: (records: SupplierTopup[]) => SupplierTopup[]) {
  const supabase = getServerSupabase();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { usageGuide, updatedAt } = await readSettings();
    const nextRecords = change(parseSupplierTopups(usageGuide));
    let query = supabase
      .from('site_settings')
      .update({ usage_guide: withSupplierTopups(usageGuide, nextRecords), updated_at: new Date().toISOString() })
      .eq('id', 'main');
    query = updatedAt ? query.eq('updated_at', updatedAt) : query.is('updated_at', null);
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (data?.length) return nextRecords;
  }
  throw new Error('設定剛好被其他操作更新，請再按一次儲存');
}

function respond(records: SupplierTopup[]) {
  return NextResponse.json({ records, summary: summarizeSupplierTopups(records) });
}

function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : '操作失敗' }, { status: 500 });
}

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const { usageGuide } = await readSettings();
    return respond(parseSupplierTopups(usageGuide));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  let input;
  try {
    input = normalizeSupplierTopupInput(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '資料格式不正確' }, { status: 400 });
  }
  try {
    const record: SupplierTopup = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
    return respond(await updateRecords(records => [record, ...records]));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: '缺少紀錄 ID' }, { status: 400 });
  try {
    return respond(await updateRecords(records => records.filter(record => record.id !== id)));
  } catch (error) {
    return errorResponse(error);
  }
}
