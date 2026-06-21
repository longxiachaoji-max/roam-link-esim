import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_HOST = 'pay.firstesim.space';
const STOREFRONT_HOSTS = new Set(['firstesim.space', 'www.firstesim.space', 'roma-link-esim.vercel.app']);

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const { pathname } = request.nextUrl;

  if (hostname === PAYMENT_HOST && pathname === '/') {
    return NextResponse.rewrite(new URL(`/topup${request.nextUrl.search}`, request.url));
  }

  if (STOREFRONT_HOSTS.has(hostname) && pathname === '/topup') {
    return NextResponse.redirect(`https://${PAYMENT_HOST}${request.nextUrl.search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/topup']
};
