import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEasyEuiccIntentUrl, buildIosInstallUrl, buildLpaString, isInFirstRoamLinkApp } from '../src/lib/esim-install-links.ts';

const LPA = buildLpaString('rsp.example.com', 'ABC-123');

test('builds the LPA string', () => {
  assert.equal(LPA, 'LPA:1$rsp.example.com$ABC-123');
});

test('falls back to the Apple universal install link', () => {
  assert.equal(buildIosInstallUrl(LPA), 'https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA%3A1%24rsp.example.com%24ABC-123');
  assert.equal(buildIosInstallUrl(LPA, 'https://stored.example/ios'), 'https://stored.example/ios');
});

test('targets EasyEUICC with an LPA intent and a download fallback', () => {
  assert.equal(
    buildEasyEuiccIntentUrl(LPA),
    'intent:1$rsp.example.com$ABC-123#Intent;scheme=LPA;package=im.angry.easyeuicc;S.browser_fallback_url=https%3A%2F%2Feasyeuicc.org;end'
  );
});

test('targets the FirstRoamLink app package when running inside it', () => {
  assert.ok(buildEasyEuiccIntentUrl(LPA, 'space.firstesim.app').includes('package=space.firstesim.app;'));
  assert.ok(buildEasyEuiccIntentUrl(LPA, 'space.firstesim.app').includes('firstesim.space%2Fapp%3Freader%3Dmissing'));
  assert.equal(isInFirstRoamLinkApp({ referrer: 'android-app://space.firstesim.app/', remembered: null }), true);
  assert.equal(isInFirstRoamLinkApp({ referrer: '', remembered: '1' }), true);
  assert.equal(isInFirstRoamLinkApp({ referrer: '', remembered: null, search: '?source=app' }), true);
  const androidUa = 'Mozilla/5.0 (Linux; Android 16; Pixel 8a) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
  assert.equal(isInFirstRoamLinkApp({ referrer: '', remembered: null, standalone: true, userAgent: androidUa }), true);
  assert.equal(isInFirstRoamLinkApp({ referrer: '', remembered: null, standalone: false, userAgent: androidUa }), false);
  assert.equal(isInFirstRoamLinkApp({ referrer: 'https://www.google.com/', remembered: null }), false);
});
