import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completePendingPurchase,
  rememberPendingPurchase,
  toGoogleAnalyticsItems,
  trackImmediatePurchase
} from '../../src/lib/analytics.ts';

function installBrowserMock() {
  const storage = new Map<string, string>();
  const events: unknown[][] = [];
  (globalThis as any).window = {
    dataLayer: [],
    gtag: (...args: unknown[]) => events.push(args),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  };
  return { events, storage };
}

test('maps eSIM cart data to GA4 ecommerce items', () => {
  const [item] = toGoogleAnalyticsItems([{
    id: 'plan-1',
    country: '日本',
    data: 'KDDI 吃到飽',
    days: '5天',
    price: 599
  }]);

  assert.deepEqual(item, {
    item_id: 'plan-1',
    item_name: '日本 KDDI 吃到飽',
    item_brand: 'FirstRoamLink',
    item_category: 'Travel eSIM',
    item_variant: '5天',
    price: 599,
    quantity: 1
  });
});

test('sends each purchase transaction only once', () => {
  const { events } = installBrowserMock();
  const payload = {
    orderId: 'order-id-1',
    transactionId: 'ORDER-1001',
    value: 599,
    items: [{ id: 'plan-1', country: '日本', data: 'KDDI 吃到飽', days: '5天', price: 599 }]
  };

  assert.equal(trackImmediatePurchase(payload), true);
  assert.equal(trackImmediatePurchase(payload), false);
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'event');
  assert.equal(events[0][1], 'purchase');
  assert.equal((events[0][2] as Record<string, unknown>).transaction_id, 'ORDER-1001');
});

test('restores a pending checkout after returning from the payment provider', () => {
  const { events, storage } = installBrowserMock();
  rememberPendingPurchase({
    orderId: 'order-id-2',
    transactionId: 'ORDER-1002',
    value: 339,
    items: [{ id: 'plan-2', country: '日本', data: 'SoftBank 每日 2GB', days: '7天', price: 339 }]
  });

  assert.equal(completePendingPurchase('order-id-2'), true);
  assert.equal(events.length, 1);
  assert.equal((events[0][2] as Record<string, unknown>).transaction_id, 'ORDER-1002');
  assert.equal(storage.has('roamlink_ga_pending_purchase_order-id-2'), false);
});
