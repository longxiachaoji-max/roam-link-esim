import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEsimPlanSeo } from '../../src/lib/esim-plan-seo.ts';

test('builds a useful description instead of using the hotspot note alone', () => {
  const seo = buildEsimPlanSeo({
    destinationName: '日本',
    dataAmount: '本地網路SoftBank每日10GB',
    description: '熱點分享總量2GB',
    options: [
      { validityDays: 1, price: 159 },
      { validityDays: 3, price: 389 },
      { validityDays: 30, price: 3399 }
    ]
  });

  assert.match(seo.description, /日本 本地網路SoftBank每日10GB eSIM/);
  assert.match(seo.description, /1 天、3 天、30 天/);
  assert.match(seo.description, /NT\$159 起/);
  assert.match(seo.description, /熱點分享總量2GB/);
  assert.ok(seo.description.length <= 160);
});

test('summarizes long day lists and works without a public note', () => {
  const seo = buildEsimPlanSeo({
    destinationName: '韓國',
    dataAmount: '每日1GB',
    description: '',
    options: [1, 2, 3, 5, 7, 10].map(validityDays => ({ validityDays, price: 100 + validityDays }))
  });

  assert.match(seo.description, /1 至 10 天等多種天數/);
  assert.doesNotMatch(seo.description, /undefined|null/);
  assert.deepEqual(seo.keywords.slice(0, 3), ['韓國 eSIM', '韓國網卡', '韓國旅遊上網']);
});

test('does not treat the legacy hotspot fallback as a supplier note', () => {
  const seo = buildEsimPlanSeo({
    destinationName: '泰國',
    dataAmount: '每日2GB',
    description: '熱點依當地電信規則',
    options: [{ validityDays: 5, price: 199 }]
  });

  assert.doesNotMatch(seo.description, /熱點/);
});
