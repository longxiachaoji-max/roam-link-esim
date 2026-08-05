import { NextResponse } from 'next/server';
import { adminApiGuard, getServerSupabase } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;

  try {
    const supabase = getServerSupabase();
    const [esimResult, physicalResult] = await Promise.all([
      supabase
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
        .limit(1000),
      supabase
        .from('physical_product_reviews')
        .select(`
          id,
          rating,
          comment,
          is_visible,
          created_at,
          updated_at,
          customers ( email, name ),
          physical_products ( id, name, category ),
          physical_orders ( id )
        `)
        .order('created_at', { ascending: false })
        .limit(1000)
    ]);
    if (esimResult.error) throw esimResult.error;
    if (physicalResult.error) throw physicalResult.error;

    const reviews = [
      ...(esimResult.data || []).map(review => ({ ...review, review_type: 'esim' as const })),
      ...(physicalResult.data || []).map(review => ({
        ...review,
        review_type: 'physical' as const,
        smoothness_rating: null
      }))
    ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return NextResponse.json({ reviews });
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
    const reviewType = body.reviewType === 'physical' ? 'physical' : body.reviewType === 'esim' ? 'esim' : null;
    if (!id || !reviewType || typeof body.isVisible !== 'boolean') {
      return NextResponse.json({ error: '評論資料不正確' }, { status: 400 });
    }

    const { data, error } = await getServerSupabase()
      .from(reviewType === 'physical' ? 'physical_product_reviews' : 'product_reviews')
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
