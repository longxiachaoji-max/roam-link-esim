import { NextResponse } from 'next/server';
import {
  getPhysicalStoreAdmin,
  normalizePhysicalProduct,
  PHYSICAL_PRODUCT_CATEGORIES,
  requirePhysicalStoreAdmin,
  type PhysicalProductCategory
} from '@/lib/physical-store';
import { normalizeRentalPriceTiers } from '@/lib/rental-pricing';

export const dynamic = 'force-dynamic';

function cleanPayload(body: Record<string, unknown>) {
  const category = String(body.category || 'travel_card') as PhysicalProductCategory;
  if (!(category in PHYSICAL_PRODUCT_CATEGORIES)) throw new Error('商品分類不正確');
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const stockQuantity = Number(body.stock_quantity);
  if (!name) throw new Error('請輸入商品名稱');
  if (!Number.isFinite(price) || price < 0) throw new Error('商品價格不正確');
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) throw new Error('庫存數量不正確');

  return {
    name: name.slice(0, 160),
    category,
    summary: String(body.summary || '').trim().slice(0, 300) || null,
    description: String(body.description || '').trim() || null,
    rental_terms: String(body.rental_terms || '').trim() || null,
    rental_price_tiers: category === 'rental' ? normalizeRentalPriceTiers(body.rental_price_tiers) : [],
    rental_free_shipping_days: category === 'rental' && Number(body.rental_free_shipping_days) > 0
      ? Math.min(365, Math.trunc(Number(body.rental_free_shipping_days)))
      : null,
    price,
    stock_quantity: stockQuantity,
    images: Array.isArray(body.images)
      ? body.images.map(value => String(value || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    is_active: Boolean(body.is_active),
    sort_order: Number.isFinite(Number(body.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0
  };
}

export async function GET(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: (data || []).map(row => normalizePhysicalProduct(row)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取商品失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const payload = cleanPayload(await request.json());
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_products')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ product: normalizePhysicalProduct(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '新增商品失敗' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 });
    const payload = cleanPayload(body);
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_products')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ product: normalizePhysicalProduct(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新商品失敗' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 });
    const { error } = await getPhysicalStoreAdmin().from('physical_products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '刪除商品失敗' }, { status: 500 });
  }
}
