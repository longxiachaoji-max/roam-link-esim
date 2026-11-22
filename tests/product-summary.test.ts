import test from 'node:test';
import assert from 'node:assert/strict';
import { groupProductNames, summarizeProductNames } from '../src/lib/product-summary.ts';

test('groups repeated product names with quantity', () => {
  assert.equal(summarizeProductNames(['台灣 7天', '台灣 7天', '日本 3天', '台灣 7天']), '台灣 7天 × 3、日本 3天');
  assert.deepEqual(groupProductNames([null, '']), [{ name: 'eSIM 商品', quantity: 2 }]);
});
