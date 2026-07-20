import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (!fromDate || !toDate || toDate < fromDate) {
      return NextResponse.json({ error: '查詢日期不正確' }, { status: 400 });
    }
    const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (rangeDays > 370) return NextResponse.json({ error: '一次最多查詢 370 天' }, { status: 400 });

    const supabase = getPhysicalStoreAdmin();
    const { data: product, error: productError } = await supabase
      .from('physical_products')
      .select('id, category, stock_quantity')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (productError) throw productError;
    if (!product || product.category !== 'rental') {
      return NextResponse.json({ error: '找不到租借商品' }, { status: 404 });
    }

    const { data, error } = await supabase.rpc('get_physical_rental_availability', {
      p_product_id: id,
      p_from_date: from,
      p_to_date: to
    });
    if (error) throw error;

    const stockQuantity = Math.max(0, Number(product.stock_quantity || 0));
    const reservations = (data || []).map((row: { reserved_date: string; reserved_quantity: number | string }) => ({
      date: row.reserved_date,
      reservedQuantity: Number(row.reserved_quantity || 0),
      remainingQuantity: Math.max(0, stockQuantity - Number(row.reserved_quantity || 0))
    }));

    return NextResponse.json({ stockQuantity, reservations }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    });
  } catch (error) {
    console.error('Rental availability error:', error);
    return NextResponse.json({ error: '租借日期載入失敗，請稍後再試' }, { status: 500 });
  }
}
