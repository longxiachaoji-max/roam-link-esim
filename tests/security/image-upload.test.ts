import assert from 'node:assert/strict';
import test from 'node:test';
import { detectImageType } from '../../src/lib/image-upload.ts';

test('detects supported image signatures', () => {
  assert.deepEqual(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), {
    mimeType: 'image/jpeg',
    extension: 'jpg'
  });
  assert.deepEqual(detectImageType(new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ])), {
    mimeType: 'image/png',
    extension: 'png'
  });
  assert.deepEqual(detectImageType(new TextEncoder().encode('RIFF0000WEBP')), {
    mimeType: 'image/webp',
    extension: 'webp'
  });
  assert.deepEqual(detectImageType(new TextEncoder().encode('0000ftypavif0000')), {
    mimeType: 'image/avif',
    extension: 'avif'
  });
});

test('rejects files whose contents are not a supported image', () => {
  assert.equal(detectImageType(new TextEncoder().encode('<script>alert(1)</script>')), null);
});
