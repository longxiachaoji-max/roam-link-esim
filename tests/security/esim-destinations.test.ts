import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAutomaticEsimDestination,
  getEsimDestination,
  getEsimDestinationForCountry,
  getEsimDestinationHref,
  isValidAutomaticEsimCountry
} from '../../src/lib/esim-destinations.ts';

test('keeps curated destination pages for popular countries', () => {
  assert.equal(getEsimDestination('japan')?.name, '日本 eSIM');
  assert.equal(getEsimDestinationForCountry('中國 香港 澳門')?.slug, 'greater-china');
  assert.equal(getEsimDestination('indonesia')?.name, '印尼 eSIM');
  assert.equal(getEsimDestinationForCountry('印尼')?.slug, 'indonesia');
  assert.equal(getEsimDestination('indonesia') && getEsimDestinationHref(getEsimDestination('indonesia')!), '/esim/indonesia');
  assert.ok(getEsimDestination('japan')?.keywords.includes('日本網卡推薦'));
  assert.ok((getEsimDestination('japan')?.guides?.length || 0) >= 3);
});

test('creates a safe automatic eSIM page configuration for a newly listed country', () => {
  const destination = createAutomaticEsimDestination('新加坡');
  assert.equal(destination?.title, '新加坡 eSIM 推薦｜新加坡網卡、流量與吃到飽方案');
  assert.equal(destination && getEsimDestinationHref(destination), '/esim/%E6%96%B0%E5%8A%A0%E5%9D%A1');
});

test('rejects unsafe or empty automatic country paths', () => {
  assert.equal(isValidAutomaticEsimCountry(''), false);
  assert.equal(isValidAutomaticEsimCountry('../admin'), false);
  assert.equal(createAutomaticEsimDestination('日本/韓國'), null);
});
