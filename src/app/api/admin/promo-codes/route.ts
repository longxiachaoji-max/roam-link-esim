import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - 取得所有優惠代碼
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ promoCodes: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - 新增優惠代碼
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, reward_tokens, max_uses, expires_at } = body;

    if (!code || !reward_tokens) {
      return NextResponse.json({ error: '代碼和獎勵點數為必填' }, { status: 400 });
    }

    const insertData: any = {
      code: code.toUpperCase(),
      reward_tokens: Number(reward_tokens),
      max_uses: Number(max_uses) || 1,
      reward_type: 'tokens',
    };
    if (expires_at) insertData.expires_at = expires_at;

    const { data, error } = await supabase
      .from('promo_codes')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '此代碼已存在' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, promoCode: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - 更新優惠代碼
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, code, reward_tokens, max_uses, expires_at } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少代碼 ID' }, { status: 400 });
    }

    const updateData: any = {};
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (reward_tokens !== undefined) updateData.reward_tokens = Number(reward_tokens);
    if (max_uses !== undefined) updateData.max_uses = Number(max_uses);
    if (expires_at !== undefined) updateData.expires_at = expires_at || null;

    const { error } = await supabase
      .from('promo_codes')
      .update(updateData)
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '此代碼已存在' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - 刪除優惠代碼
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少代碼 ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
