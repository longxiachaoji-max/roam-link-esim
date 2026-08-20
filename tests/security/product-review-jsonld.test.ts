import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductReviewJsonLd } from '../../src/lib/product-review-jsonld.ts';

test('builds review structured data only from valid visible review values', () => {
  const result = buildProductReviewJsonLd([
    { rating: 5, comment: '連線順暢，安裝也很快。', createdAt: '2026-08-20T10:00:00.000Z' },
    { rating: 0, comment: '無效評分', createdAt: '2026-08-20T10:00:00.000Z' },
    { rating: 4, comment: '   ', createdAt: '2026-08-20T10:00:00.000Z' }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].reviewBody, '連線順暢，安裝也很快。');
  assert.equal(result[0].reviewRating.ratingValue, 5);
  assert.equal(result[0].author.name, '已購買會員');
});
