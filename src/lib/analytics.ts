export type AnalyticsEventType =
  | 'topup_page_view'
  | 'roamlink_page_view'
  | 'topup_to_roamlink_click';

export interface GoogleAnalyticsItem {
  item_id: string;
  item_name: string;
  item_brand: 'FirstRoamLink';
  item_category: 'Travel eSIM';
  item_variant?: string;
  price: number;
  quantity: number;
}

interface CartAnalyticsItem {
  id?: unknown;
  country?: unknown;
  data?: unknown;
  dataAmount?: unknown;
  days?: unknown;
  validityDays?: unknown;
  price?: unknown;
}

interface PurchaseAnalyticsPayload {
  orderId: string;
  transactionId: string;
  value: number;
  coupon?: string;
  items: GoogleAnalyticsItem[];
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const VISITOR_ID_KEY = 'roamlink_analytics_visitor_id';
const PENDING_PURCHASE_PREFIX = 'roamlink_ga_pending_purchase_';
const COMPLETED_PURCHASE_PREFIX = 'roamlink_ga_purchase_';

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function toGoogleAnalyticsItems(items: CartAnalyticsItem[]): GoogleAnalyticsItem[] {
  return items.map((item, index) => {
    const country = cleanText(item.country) || '全球';
    const dataAmount = cleanText(item.data ?? item.dataAmount) || 'eSIM';
    const validity = cleanText(item.days ?? item.validityDays);
    return {
      item_id: cleanText(item.id) || `esim-${index + 1}`,
      item_name: `${country} ${dataAmount}`,
      item_brand: 'FirstRoamLink',
      item_category: 'Travel eSIM',
      ...(validity ? { item_variant: validity } : {}),
      price: positiveNumber(item.price),
      quantity: 1
    };
  });
}

function sendGoogleAnalyticsEvent(eventName: string, parameters: Record<string, unknown>) {
  if (typeof window === 'undefined') return false;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
  window.gtag('event', eventName, parameters);
  return true;
}

export function trackViewItem(item: CartAnalyticsItem) {
  const items = toGoogleAnalyticsItems([item]);
  sendGoogleAnalyticsEvent('view_item', {
    currency: 'TWD',
    value: items[0]?.price || 0,
    items
  });
}

export function trackAddToCart(item: CartAnalyticsItem) {
  const items = toGoogleAnalyticsItems([item]);
  sendGoogleAnalyticsEvent('add_to_cart', {
    currency: 'TWD',
    value: items[0]?.price || 0,
    items
  });
}

export function trackBeginCheckout(items: CartAnalyticsItem[], value: number, coupon?: string) {
  sendGoogleAnalyticsEvent('begin_checkout', {
    currency: 'TWD',
    value: positiveNumber(value),
    ...(coupon ? { coupon } : {}),
    items: toGoogleAnalyticsItems(items)
  });
}

export function rememberPendingPurchase(payload: {
  orderId: string;
  transactionId?: string;
  value: number;
  coupon?: string;
  items: CartAnalyticsItem[];
}) {
  try {
    const orderId = cleanText(payload.orderId);
    if (!orderId) return;
    const purchase: PurchaseAnalyticsPayload = {
      orderId,
      transactionId: cleanText(payload.transactionId) || orderId,
      value: positiveNumber(payload.value),
      coupon: cleanText(payload.coupon) || undefined,
      items: toGoogleAnalyticsItems(payload.items)
    };
    window.localStorage.setItem(`${PENDING_PURCHASE_PREFIX}${orderId}`, JSON.stringify(purchase));
  } catch {
    // Tracking storage must never interrupt payment.
  }
}

function trackPurchaseOnce(payload: PurchaseAnalyticsPayload) {
  try {
    const transactionId = cleanText(payload.transactionId) || cleanText(payload.orderId);
    if (!transactionId) return false;
    const completedKey = `${COMPLETED_PURCHASE_PREFIX}${transactionId}`;
    if (window.localStorage.getItem(completedKey)) return false;
    const sent = sendGoogleAnalyticsEvent('purchase', {
      transaction_id: transactionId,
      currency: 'TWD',
      value: positiveNumber(payload.value),
      ...(payload.coupon ? { coupon: payload.coupon } : {}),
      items: payload.items
    });
    if (sent) window.localStorage.setItem(completedKey, '1');
    return sent;
  } catch {
    return false;
  }
}

export function trackImmediatePurchase(payload: {
  orderId: string;
  transactionId?: string;
  value: number;
  coupon?: string;
  items: CartAnalyticsItem[];
}) {
  return trackPurchaseOnce({
    orderId: cleanText(payload.orderId),
    transactionId: cleanText(payload.transactionId) || cleanText(payload.orderId),
    value: positiveNumber(payload.value),
    coupon: cleanText(payload.coupon) || undefined,
    items: toGoogleAnalyticsItems(payload.items)
  });
}

export function completePendingPurchase(orderIdValue: string, fallbackValue?: number) {
  try {
    const orderId = cleanText(orderIdValue);
    if (!orderId) return false;
    const pendingKey = `${PENDING_PURCHASE_PREFIX}${orderId}`;
    const raw = window.localStorage.getItem(pendingKey);
    const pending = raw ? JSON.parse(raw) as PurchaseAnalyticsPayload : null;
    const sent = trackPurchaseOnce(pending || {
      orderId,
      transactionId: orderId,
      value: positiveNumber(fallbackValue),
      items: []
    });
    if (sent || pending) window.localStorage.removeItem(pendingKey);
    return sent;
  } catch {
    return false;
  }
}

export function getAnalyticsVisitorId() {
  let visitorId = window.localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

export function trackAnalyticsEvent(eventType: AnalyticsEventType) {
  try {
    void fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        visitorId: getAnalyticsVisitorId(),
        sourcePath: window.location.pathname
      }),
      keepalive: true
    });
  } catch {
    // Analytics must never interrupt shopping or payment flows.
  }
}

export function trackPageView(eventType: Extract<AnalyticsEventType, 'topup_page_view' | 'roamlink_page_view'>) {
  const sessionKey = `roamlink_analytics_${eventType}`;
  if (window.sessionStorage.getItem(sessionKey)) return;
  window.sessionStorage.setItem(sessionKey, '1');
  trackAnalyticsEvent(eventType);
}
