'use client';

// 瀏覽器端：記下客人從哪裡進站（第一次／最近一次），結帳時附在訂單上
import type { AttributionTouch, OrderAttribution } from '@/lib/order-attribution';

const FIRST_KEY = 'frl_attr_first';
const LAST_KEY = 'frl_attr_last';
const FIRST_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function detectInApp(userAgent: string) {
  if (/\bLine\//i.test(userAgent)) return 'line';
  if (/Instagram/i.test(userAgent)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return 'facebook';
  return undefined;
}

function read(key: string): AttributionTouch | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, touch: AttributionTouch) {
  try { window.localStorage.setItem(key, JSON.stringify(touch)); } catch { /* 私密模式 */ }
}

export function captureAttribution() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const get = (name: string) => params.get(name)?.slice(0, 120) || undefined;
  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const url = new URL(document.referrer);
      if (url.host !== window.location.host) referrer = url.protocol === 'android-app:' ? document.referrer.slice(0, 200) : `${url.host}${url.pathname}`.slice(0, 200);
    }
  } catch { /* 無效 referrer */ }

  const touch: AttributionTouch = {
    source: get('utm_source'),
    medium: get('utm_medium'),
    campaign: get('utm_campaign'),
    term: get('utm_term'),
    content: get('utm_content'),
    gclid: params.has('gclid') || params.has('gbraid') || params.has('wbraid') || undefined,
    fbclid: params.has('fbclid') || undefined,
    ref: get('ref'),
    referrer,
    landing: window.location.pathname.slice(0, 200),
    inApp: detectInApp(navigator.userAgent),
    at: new Date().toISOString(),
  };
  const external = Boolean(touch.source || touch.gclid || touch.fbclid || touch.ref || touch.referrer || touch.inApp);

  const first = read(FIRST_KEY);
  const firstExpired = !first?.at || Date.now() - Date.parse(first.at) > FIRST_TTL_MS;
  if (!first || (firstExpired && external)) write(FIRST_KEY, touch);
  // 站內換頁不覆蓋；從外部再進來才更新「最近一次」
  if (external || !read(LAST_KEY)) write(LAST_KEY, touch);
}

export function getAttributionPayload(): OrderAttribution | undefined {
  if (typeof window === 'undefined') return undefined;
  const first = read(FIRST_KEY);
  const last = read(LAST_KEY);
  return first || last ? { first, last } : undefined;
}
