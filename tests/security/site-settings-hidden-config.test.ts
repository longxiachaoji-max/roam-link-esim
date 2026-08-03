import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHiddenSiteConfigComments,
  stripHiddenSiteConfig
} from '../../src/lib/site-settings-hidden-config.ts';

const guide = `iPhone：點選一鍵安裝。

<!--PRODUCT_SORT_CONFIG:eyJzb3J0IjpbXX0=-->

Android：掃描 QR Code。

<!--MICROESIM_FAVORITES:eyJwbGFuSWRzIjpbIjEyMyJdfQ==-->

<!--FUTURE_SETTING:e30=-->`;

test('removes every internal settings block from the public usage guide', () => {
  assert.equal(
    stripHiddenSiteConfig(guide),
    'iPhone：點選一鍵安裝。\n\nAndroid：掃描 QR Code。'
  );
});

test('preserves hidden settings when an admin edits the visible guide', () => {
  assert.deepEqual(getHiddenSiteConfigComments(guide), [
    '<!--PRODUCT_SORT_CONFIG:eyJzb3J0IjpbXX0=-->',
    '<!--MICROESIM_FAVORITES:eyJwbGFuSWRzIjpbIjEyMyJdfQ==-->',
    '<!--FUTURE_SETTING:e30=-->'
  ]);
});
