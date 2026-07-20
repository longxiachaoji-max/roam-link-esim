import { NextResponse } from 'next/server';
import { AuthenticationError, getServerSupabase, requireAdminUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : '管理員帳號操作失敗' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('admin_users').select('user_id, email, created_at').order('created_at');
    if (error) throw error;
    return NextResponse.json({ admins: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const { email: rawEmail, password } = await request.json();
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: '請輸入有效 Email' }, { status: 400 });
    if (typeof password !== 'string' || password.length < 12) {
      return NextResponse.json({ error: '新帳號密碼至少需要 12 碼' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    let authUser = userList.users.find(user => user.email?.toLowerCase() === email) || null;
    let createdNewUser = false;

    if (authUser) {
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, { password });
      if (updateError || !updated.user) throw updateError || new Error('無法更新既有帳號');
      authUser = updated.user;
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (createError || !created.user) throw createError || new Error('無法建立帳號');
      authUser = created.user;
      createdNewUser = true;
    }

    const { error: insertError } = await supabase.from('admin_users').upsert({
      user_id: authUser.id,
      email
    }, { onConflict: 'user_id' });
    if (insertError) {
      if (createdNewUser) await supabase.auth.admin.deleteUser(authUser.id);
      throw insertError;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAdminUser(request);
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: '缺少管理員編號' }, { status: 400 });
    if (userId === currentUser.id) return NextResponse.json({ error: '不能移除自己的後台權限' }, { status: 400 });

    const supabase = getServerSupabase();
    const { count } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
    if ((count || 0) <= 1) return NextResponse.json({ error: '至少需要保留一位管理員' }, { status: 400 });
    const { error } = await supabase.from('admin_users').delete().eq('user_id', userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
