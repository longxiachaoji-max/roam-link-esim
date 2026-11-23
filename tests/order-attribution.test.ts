import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttribution, classifyTouch, sanitizeAttribution } from '../src/lib/order-attribution.ts';

test('classifies common traffic sources', () => {
  assert.equal(classifyTouch({ referrer: 'www.google.com/' }), 'Google 搜尋');
  assert.equal(classifyTouch({ gclid: true, referrer: 'www.google.com/' }), 'Google 廣告');
  assert.equal(classifyTouch({ source: 'facebook', medium: 'cpc' }), 'FB/IG 廣告');
  assert.equal(classifyTouch({ inApp: 'line' }), 'LINE');
  assert.equal(classifyTouch({ referrer: 'line.me/R/ti/p/abc' }), 'LINE');
  assert.equal(classifyTouch({ ref: 'ABC123', referrer: 'line.me/x' }), '推薦連結');
  assert.equal(classifyTouch({ referrer: 'm.facebook.com/' }), 'Facebook');
  assert.equal(classifyTouch({ referrer: 'chatgpt.com/' }), 'AI 助理');
  assert.equal(classifyTouch({ referrer: 'android-app://space.firstesim.app/' }), 'App');
  assert.equal(classifyTouch({ landing: '/' }), '直接造訪');
  assert.equal(classifyTouch({ referrer: 'blog.example.com/post' }), '其他網站（blog.example.com）');
});

test('prefers last external touch, falls back to first', () => {
  assert.equal(classifyAttribution({ first: { referrer: 'www.google.com/' }, last: { landing: '/' } }), 'Google 搜尋');
  assert.equal(classifyAttribution({ first: { referrer: 'www.google.com/' }, last: { inApp: 'line' } }), 'LINE');
  assert.equal(classifyAttribution(null), '未知');
});

test('sanitizes untrusted payloads', () => {
  assert.equal(sanitizeAttribution('x'), null);
  const clean = sanitizeAttribution({ first: { source: 'GOOGLE', evil: 'x', term: 'a'.repeat(500) }, last: null });
  assert.equal(clean?.first?.source, 'google');
  assert.equal(clean?.first?.term?.length, 120);
  assert.equal((clean?.first as Record<string, unknown>).evil, undefined);
});
