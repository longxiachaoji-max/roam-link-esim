import { NextResponse } from 'next/server';
import { AuthenticationError, requireAdminUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAdminUser(request);
    return NextResponse.json({ authenticated: true, email: user.email });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '無法驗證管理員登入狀態' }, { status: 500 });
  }
}
