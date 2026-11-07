import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEasyEuiccIntentUrl, buildIosInstallUrl, buildLpaString } from '../src/lib/esim-install-links.ts';

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
