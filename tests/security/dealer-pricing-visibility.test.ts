import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('dealer storefront only labels the final dealer price', async () => {
  const page = await source('src/app/dealer/page.tsx');

  assert.match(page, />經銷價</);
  assert.doesNotMatch(page, /pricingLabel|成本＋/);
});

test('dealer-facing APIs do not return internal pricing rules', async () => {
  const paths = [
    'src/app/api/dealer/products/route.ts',
    'src/app/api/dealer/profile/route.ts',
    'src/app/api/dealer/register/route.ts',
    'src/app/api/dealer/orders/route.ts'
  ];
  const contents = await Promise.all(paths.map(source));

  for (const content of contents) {
    assert.doesNotMatch(content, /pricingMode\s*[,}]/);
    assert.doesNotMatch(content, /pricingValue\s*[,}]/);
    assert.doesNotMatch(content, /price_rate_percent/);
  }
  assert.doesNotMatch(contents[1], /\.select\('\*'\)/);
  assert.doesNotMatch(contents[2], /\.select\('\*'\)/);
});
