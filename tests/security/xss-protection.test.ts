import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import nextConfig from '../../next.config.ts';
import { serializeJsonLd } from '../../src/lib/json-ld.ts';

test('markdown does not execute embedded HTML or unsafe links', () => {
  const markdown = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[unsafe](javascript:alert(1))',
    '**safe text**'
  ].join('\n\n');
  const html = renderToStaticMarkup(createElement(Markdown, {
    remarkPlugins: [remarkGfm]
  }, markdown));

  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('onerror="'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.equal(html.includes('<strong>safe text</strong>'), true);
});

test('JSON-LD serialization cannot close its script element', () => {
  const serialized = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
  assert.equal(serialized.includes('</script>'), false);
  assert.deepEqual(JSON.parse(serialized), { name: '</script><script>alert(1)</script>' });
});

test('global response headers include the browser security baseline', async () => {
  const entries = await nextConfig.headers?.();
  const headers = new Map(entries?.[0]?.headers.map(header => [header.key, header.value]));

  assert.match(headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  assert.match(headers.get('Content-Security-Policy') || '', /form-action 'self' https:\/\/payment\.ecpay\.com\.tw/);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});
