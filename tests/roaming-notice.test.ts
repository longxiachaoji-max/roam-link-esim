import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresDataRoaming } from '../src/lib/roaming-notice.ts';

test('local network plans do not need data roaming', () => {
  assert.equal(requiresDataRoaming('日本 本地網路KDDI 吃到飽', '吃到飽'), false);
  assert.equal(requiresDataRoaming(null, '本地網路SoftBank每日3GB'), false);
});

test('all other plans need data roaming', () => {
  assert.equal(requiresDataRoaming('日本 吃到飽', '吃到飽'), true);
  assert.equal(requiresDataRoaming(null, undefined), true);
});
