import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManualEsimInput } from '../src/lib/manual-esim.ts';

test('parses a full LPA string', () => {
  assert.deepEqual(
    parseManualEsimInput({ lpa: 'LPA:1$rsp.example.com$ABC-123' }),
    { smdp_address: 'rsp.example.com', activation_code: 'ABC-123' }
  );
});

test('ignores whitespace and line breaks pasted with the LPA string', () => {
  assert.deepEqual(
    parseManualEsimInput({ lpa: '  LPA:1$rsp.example.com$\nABC-123 ' }),
    { smdp_address: 'rsp.example.com', activation_code: 'ABC-123' }
  );
});

test('keeps $ characters that belong to the activation code', () => {
  assert.deepEqual(
    parseManualEsimInput({ lpa: 'LPA:1$rsp.example.com$ABC$1.3.6.1' }),
    { smdp_address: 'rsp.example.com', activation_code: 'ABC$1.3.6.1' }
  );
});

test('prefers the LPA string over separate fields', () => {
  assert.deepEqual(
    parseManualEsimInput({ lpa: 'LPA:1$a.example.com$CODE', smdp_address: 'b.example.com', activation_code: 'OTHER' }),
    { smdp_address: 'a.example.com', activation_code: 'CODE' }
  );
});

test('accepts separate SM-DP+ address and activation code', () => {
  assert.deepEqual(
    parseManualEsimInput({ smdp_address: ' rsp.example.com ', activation_code: ' ABC-123 ' }),
    { smdp_address: 'rsp.example.com', activation_code: 'ABC-123' }
  );
});

test('rejects malformed LPA strings', () => {
  assert.throws(() => parseManualEsimInput({ lpa: 'rsp.example.com$ABC' }), /LPA 格式不正確/);
  assert.throws(() => parseManualEsimInput({ lpa: 'LPA:1$rsp.example.com$' }), /LPA 格式不正確/);
});

test('rejects missing fields', () => {
  assert.throws(() => parseManualEsimInput({ smdp_address: 'rsp.example.com' }), /SM-DP\+ 地址與啟用碼/);
  assert.throws(() => parseManualEsimInput({}), /SM-DP\+ 地址與啟用碼/);
});
