import assert from 'node:assert/strict';
import test from 'node:test';
import { createEsimShareToken, verifyEsimShareToken } from '../src/lib/esim-share-token.ts';

const SECRET = 'test-secret';
const ITEM_ID = '7f0c9c1e-0000-4000-8000-000000000000';

test('round-trips a share token', () => {
  const token = createEsimShareToken(ITEM_ID, SECRET);
  assert.equal(verifyEsimShareToken(token, SECRET)?.orderItemId, ITEM_ID);
});

test('rejects a token signed with another secret', () => {
  const token = createEsimShareToken(ITEM_ID, 'other-secret');
  assert.equal(verifyEsimShareToken(token, SECRET), null);
});

test('rejects a tampered payload', () => {
  const [, signature] = createEsimShareToken(ITEM_ID, SECRET).split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ i: 'someone-else', e: 4102444800 })).toString('base64url');
  assert.equal(verifyEsimShareToken(`${forgedPayload}.${signature}`, SECRET), null);
});

test('rejects an expired token', () => {
  const issuedAt = Date.UTC(2026, 0, 1);
  const token = createEsimShareToken(ITEM_ID, SECRET, issuedAt);
  assert.ok(verifyEsimShareToken(token, SECRET, issuedAt + 29 * 86400_000));
  assert.equal(verifyEsimShareToken(token, SECRET, issuedAt + 31 * 86400_000), null);
});

test('rejects malformed tokens', () => {
  assert.equal(verifyEsimShareToken('', SECRET), null);
  assert.equal(verifyEsimShareToken('abc', SECRET), null);
  assert.equal(verifyEsimShareToken('a.b.c', SECRET), null);
});
