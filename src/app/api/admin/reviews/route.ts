import { NextResponse } from 'next/server';
import { adminApiGuard, getServerSupabase } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;

  try {
    const { data, error } = await getServerSupabase()
      .from('product_reviews')
      .select(`
        id,
        rating,
        smoothness_rating,
        comment,
        is_visible,
        created_at,
        updated_at,
        customers ( email, name ),
        products ( id, name, country, data_amount, validity_days ),
        orders ( id, order_number )
      `)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    return NextResponse.json({ reviews: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '評論載入失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id || typeof body.isVisible !== 'boolean') {
      return NextResponse.json({ error: '評論資料不正確' }, { status: 400 });
    }

    const { data, error } = await getServerSupabase()
      .from('product_reviews')
      .update({ is_visible: body.isVisible })
      .eq('id', id)
      .select('id, is_visible, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: '找不到評論' }, { status: 404 });
    return NextResponse.json({ review: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '評論狀態更新失敗' }, { status: 500 });
  }
}
