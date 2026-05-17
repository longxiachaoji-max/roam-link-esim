import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// PUT - 更新備註 或 軟刪除
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { order_item_id, email, action, note } = body;

    if (!order_item_id || !email) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 驗證此 order_item 屬於該用戶
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (!customer) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 確認 order_item 屬於該客戶的訂單
    const { data: item } = await supabase
      .from('order_items')
      .select('id, order_id, orders!inner(customer_id)')
      .eq('id', order_item_id)
      .single();

    if (!item || (item as any).orders?.customer_id !== customer.id) {
      return NextResponse.json({ error: '無權限操作此項目' }, { status: 403 });
    }

    if (action === 'soft_delete') {
      // 軟刪除：設定 user_deleted_at
      const { error } = await supabase
        .from('order_items')
        .update({ user_deleted_at: new Date().toISOString() })
        .eq('id', order_item_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已標記刪除，將於 1 天後自動移除' });

    } else if (action === 'update_note') {
      // 更新備註
      const { error } = await supabase
        .from('order_items')
        .update({ note: note || null })
        .eq('id', order_item_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
