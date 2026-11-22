import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractEid, formatEid, isValidEid, normalizeEid } from '../src/lib/eid.ts';

const EID = '89086030202200000026000498365229';

test('validates EID check digits', () => {
  assert.equal(isValidEid(EID), true);
  assert.equal(isValidEid('89086030202200000026000498365228'), false);
  assert.equal(isValidEid('8908603020220000002600049836522'), false);
  assert.equal(isValidEid('8908 6030 2022 0000 0026 0004 9836 5229'), true);
});

test('extracts EID from scanned text', () => {
  assert.equal(extractEid(`EID:${EID}`), EID);
  assert.equal(extractEid('8908 6030 2022 0000 0026 0004 9836 5229'), EID);
  assert.equal(extractEid('hello 1234'), null);
});

test('formats EID in groups of four', () => {
  assert.equal(formatEid(EID), '8908 6030 2022 0000 0026 0004 9836 5229');
  assert.equal(normalizeEid(' 89-08 '), '8908');
});
