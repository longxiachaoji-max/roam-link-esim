import assert from 'node:assert/strict';
import test from 'node:test';
import { getProductNetworkType, normalizeProductNetworkType } from '../src/lib/product-network-type.ts';

test('extracts and orders network generations from supplier network data', () => {
  assert.equal(getProductNetworkType('HK:CSL[4G;LTE;5G]|'), '4G / 5G');
  assert.equal(getProductNetworkType('JP:KDDI[5G;4G]|'), '4G / 5G');
  assert.equal(getProductNetworkType('TH:AIS[LTE]|'), '4G');
  assert.equal(getProductNetworkType('US:T-Mobile[5G]|'), '5G');
});

test('keeps a manual network label when no generation can be normalized', () => {
  assert.equal(normalizeProductNetworkType('衛星網路'), '衛星網路');
  assert.equal(normalizeProductNetworkType(' LTE / 5g '), '4G / 5G');
});
