import { NextResponse } from 'next/server';
import {
  normalizePhysicalCartSnapshot
} from '@/lib/physical-cart';
import {
  authenticationErrorResponse,
  getServerSupabase,
  requireAuthenticatedUser
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000;

async function getAuthenticatedCartContext(request: Request) {
  const user = await requireAuthenticatedUser(request);
  return { user, supabase: getServerSupabase() };
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedCartContext(request);
    const { data, error } = await supabase
      .from('member_carts')
      .select('items, updated_at')
      .eq('user_id', user.id)
      .eq('cart_type', 'physical')
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      items: normalizePhysicalCartSnapshot(data?.items),
      updatedAt: data?.updated_at || null
    });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Read member cart failed:', error);
    return NextResponse.json({ error: '讀取會員購物車失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: '購物車內容過大' }, { status: 413 });
    }

    const { user, supabase } = await getAuthenticatedCartContext(request);
    const body = await request.json();
    const rawItems = Array.isArray(body?.items) ? body.items : null;
    if (rawItems && JSON.stringify(rawItems).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: '購物車內容過大' }, { status: 413 });
    }
    if (!rawItems || rawItems.length > 20) {
      return NextResponse.json({ error: '購物車內容不正確' }, { status: 400 });
    }

    const items = normalizePhysicalCartSnapshot(rawItems);
    if (items.length !== rawItems.length) {
      return NextResponse.json({ error: '購物車包含無效商品' }, { status: 400 });
    }

    if (items.length === 0) {
      const { error } = await supabase
        .from('member_carts')
        .delete()
        .eq('user_id', user.id)
        .eq('cart_type', 'physical');
      if (error) throw error;
      return NextResponse.json({ success: true, items: [] });
    }

    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('member_carts')
      .upsert({
        user_id: user.id,
        cart_type: 'physical',
        items,
        updated_at: updatedAt
      }, { onConflict: 'user_id,cart_type' });
    if (error) throw error;

    return NextResponse.json({ success: true, items, updatedAt });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Save member cart failed:', error);
    return NextResponse.json({ error: '儲存會員購物車失敗' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedCartContext(request);
    const { error } = await supabase
      .from('member_carts')
      .delete()
      .eq('user_id', user.id)
      .eq('cart_type', 'physical');
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Clear member cart failed:', error);
    return NextResponse.json({ error: '清除會員購物車失敗' }, { status: 500 });
  }
}
