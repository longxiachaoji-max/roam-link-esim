import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// PUT - 更新會員名稱
export async function PUT(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email || !name || !name.trim()) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ name: name.trim() })
      .eq('email', email)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, customer: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
