import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin, normalizePhysicalProduct } from '@/lib/physical-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const supabase = getPhysicalStoreAdmin();
    let query = supabase
      .from('physical_products')
      .select('*')
      .eq('is_active', true);

    if (id) query = query.eq('id', id);
    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const products = (data || []).map(row => normalizePhysicalProduct(row));
    if (id && products.length === 0) {
      return NextResponse.json({ error: '找不到商品或商品尚未上架' }, { status: 404 });
    }
    return NextResponse.json({ products, product: id ? products[0] : undefined });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取商品失敗' }, { status: 500 });
  }
}
