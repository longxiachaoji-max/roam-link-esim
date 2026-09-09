import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guideData = readFileSync(new URL('../../src/lib/esim-guides.ts', import.meta.url), 'utf8');
const guideTemplate = readFileSync(new URL('../../src/app/guides/[slug]/page.tsx', import.meta.url), 'utf8');
const guidesIndex = readFileSync(new URL('../../src/app/guides/page.tsx', import.meta.url), 'utf8');
const destinationPage = readFileSync(new URL('../../src/app/esim/[slug]/page.tsx', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../../src/app/sitemap.ts', import.meta.url), 'utf8');

const expectedGuides = [
  'korea-esim',
  'china-esim',
  'hong-kong-esim',
  'vietnam-esim',
  'thailand-esim',
  'indonesia-esim',
  'taiwan-esim',
  'greater-china-esim'
];

test('supported outbound destinations have dedicated guide data and sitemap entries', () => {
  for (const slug of expectedGuides) assert.match(guideData, new RegExp(`slug: '${slug}'`));
  assert.match(sitemap, /ESIM_GUIDES\.map/);
  assert.match(destinationPage, /getEsimGuideHrefForDestination/);
  assert.match(destinationPage, /href=\{guideHref\}/);
});

test('guide priority is based on the official completed-year first-destination counts', () => {
  assert.match(guideData, /6_730_817/);
  assert.match(guideData, /3_237_511/);
  assert.match(guideData, /1_835_061/);
  assert.match(guideData, /1_626_176/);
  assert.match(guideData, /1_214_362/);
  assert.match(guideData, /1_026_976/);
  assert.match(guideData, /162_169/);
  assert.match(guidesIndex, /首站抵達地/);
  assert.match(guidesIndex, /只比較本站目前支援的出國目的地/);
  assert.match(guidesIndex, /不是全國總榜/);
});

test('country guidance preserves critical product and regulatory caveats', () => {
  assert.match(guideData, /不能一概而論。可用服務取決於方案的漫遊路由/);
  assert.match(guideData, /香港本地電信商發出的 SIM 服務與預付 SIM 依法須/);
  assert.match(guideData, /數據型旅遊 eSIM 通常不包含中國門號/);
  assert.match(guideData, /5G 只在特定涵蓋區域/);
  assert.match(guideTemplate, /吃到飽.*不等於任何時間都維持最高速度/);
  assert.match(guideTemplate, /不要把刪除 eSIM 當成第一個排除步驟/);
  assert.match(guideTemplate, /數據漫遊/);
});

test('Taiwan guide targets temporary no-contract and no-KYC usage without promising a local number', () => {
  assert.match(guideData, /台灣短期 eSIM 怎麼選/);
  assert.match(guideData, /不需要申辦月租型門號或綁長約/);
  assert.match(guideData, /不含本地門號、語音與簡訊/);
  assert.match(guideData, /目前本站上架的台灣 eSIM 方案皆免 KYC、免實名與證件核驗/);
  assert.match(guidesIndex, /在台灣臨時需要網路/);
  assert.match(guidesIndex, /目前上架方案皆免 KYC、免證件核驗/);
  assert.match(destinationPage, /getEsimGuideHrefForDestination/);
});

test('guide pages include metadata, structured data and official sources', () => {
  assert.match(guideTemplate, /generateMetadata/);
  assert.match(guideTemplate, /FAQPage/);
  assert.match(guideTemplate, /BreadcrumbList/);
  assert.match(guideTemplate, /'@type': 'Article'/);
  assert.match(guideData, /admin\.taiwan\.net\.tw/);
  assert.match(guideData, /ofca\.gov\.hk/);
  assert.match(guideData, /support\.apple\.com/);
  assert.match(guideData, /telkomsel\.com/);
});
