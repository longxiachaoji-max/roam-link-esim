import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationError, requireAdminUser } from '@/lib/server-auth';

const PAYMENT_HOST = 'pay.firstesim.space';
const STOREFRONT_HOSTS = new Set(['firstesim.space', 'www.firstesim.space', 'roma-link-esim.vercel.app']);

async function protectAdminApi(request: NextRequest) {
  try {
    await requireAdminUser(request);
    return null;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '管理員驗證服務暫時無法使用' }, { status: 503 });
  }
}

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/admin/')) {
    const denied = await protectAdminApi(request);
    if (denied) return denied;
  }

  if (hostname === PAYMENT_HOST && pathname === '/') {
    return NextResponse.rewrite(new URL(`/topup${request.nextUrl.search}`, request.url));
  }

  if (STOREFRONT_HOSTS.has(hostname) && pathname === '/topup') {
    return NextResponse.redirect(`https://${PAYMENT_HOST}${request.nextUrl.search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/topup', '/api/admin/:path*']
};
