import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guidePage = readFileSync(new URL('../../src/app/guides/japan-esim/page.tsx', import.meta.url), 'utf8');
const destinationPage = readFileSync(new URL('../../src/app/esim/[slug]/page.tsx', import.meta.url), 'utf8');
const homePage = readFileSync(new URL('../../src/app/page.tsx', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../../src/app/sitemap.ts', import.meta.url), 'utf8');

test('Japan eSIM guide targets the observed search intent without promising unrestricted service', () => {
  assert.match(guidePage, /日本網卡吃到飽/);
  assert.match(guidePage, /日本 SIM 卡吃到飽/);
  assert.match(guidePage, /每日流量型/);
  assert.match(guidePage, /總量型/);
  assert.match(guidePage, /公平使用政策/);
  assert.match(guidePage, /不一定。「吃到飽」/);
});

test('Japan eSIM guide contains critical compatibility and activation caveats', () => {
  assert.match(guidePage, /電信商鎖定/);
  assert.match(guidePage, /效期從安裝、啟用，還是首次連上日本網路後開始/);
  assert.match(guidePage, /不要把「刪除 eSIM」當作第一個排除步驟/);
  assert.match(guidePage, /關閉原門號的數據漫遊及「允許行動數據切換」/);
});

test('Japan guide cites first-party device and network sources', () => {
  assert.match(guidePage, /support\.apple\.com\/zh-tw/);
  assert.match(guidePage, /support\.google\.com\/pixelphone/);
  assert.match(guidePage, /samsung\.com\/tw\/support/);
  assert.match(guidePage, /au\.com\/mobile\/area\/map/);
  assert.match(guidePage, /softbank\.jp\/mobile\/network\/area-map/);
});

test('Japan guide is discoverable from important internal pages and the sitemap', () => {
  for (const source of [destinationPage, homePage, sitemap]) {
    assert.match(source, /\/guides\/japan-esim/);
  }
  assert.match(guidePage, /canonical: '\/guides\/japan-esim'/);
  assert.match(guidePage, /FAQPage/);
  assert.match(guidePage, /BreadcrumbList/);
  assert.match(guidePage, /'@type': 'Article'/);
});
