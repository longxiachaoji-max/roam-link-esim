import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUsageMb } from '../src/lib/usage-mb.ts';

test('parses MicroEsim usage strings into MB', () => {
  assert.equal(parseUsageMb('3404.44 MB'), 3404.44);
  assert.equal(parseUsageMb('1.5GB'), 1536);
  assert.equal(parseUsageMb('512 KB'), 0.5);
  assert.equal(parseUsageMb('120'), 120);
  assert.equal(parseUsageMb(null), null);
  assert.equal(parseUsageMb('尚未回傳'), null);
});
