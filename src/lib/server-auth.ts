import { createClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export class AuthenticationError extends Error {
  constructor(message: string, public readonly status: 401 | 403 = 401) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function requireAuthenticatedUser(request: Request): Promise<User & { email: string }> {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) throw new AuthenticationError('請先登入');

  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) throw new AuthenticationError('登入狀態已過期，請重新登入');
  return data.user as User & { email: string };
}

export async function requireAdminUser(request: Request) {
  const user = await requireAuthenticatedUser(request);
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`管理員權限資料讀取失敗：${error.message}`);
  if (!data) throw new AuthenticationError('此會員沒有後台管理權限', 403);
  return user;
}

export function authenticationErrorResponse(error: unknown) {
  if (!(error instanceof AuthenticationError)) return null;
  return NextResponse.json({ error: error.message }, { status: error.status });
}
