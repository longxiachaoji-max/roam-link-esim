import assert from 'node:assert/strict';
import test from 'node:test';
import { getProductCarrierNames } from '../src/lib/product-carriers.ts';

test('keeps every carrier for the selected country', () => {
  assert.equal(
    getProductCarrierNames('JP:KDDI[4G;LTE;5G],Softbank[4G;LTE;5G],Docomo[4G;LTE;5G]|', 'JP'),
    'KDDI / SoftBank / Docomo'
  );
});

test('does not split a comma that belongs to a carrier name', () => {
  assert.equal(
    getProductCarrierNames('TL:Telekomunikasi Indonesia International, S.A[4G;LTE]|', 'TL'),
    'Telekomunikasi Indonesia International, S.A'
  );
});

test('uses all network entries when a regional plan has no matching country code', () => {
  assert.equal(
    getProductCarrierNames('JP:KDDI[5G]|KR:SKT[5G],LGU+[5G]|', 'MULTI'),
    'KDDI / SKT / LG U+'
  );
});
