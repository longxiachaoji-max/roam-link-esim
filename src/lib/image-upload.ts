export interface DetectedImageType {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  extension: 'jpg' | 'png' | 'webp' | 'avif';
}

function ascii(bytes: Uint8Array) {
  return String.fromCharCode(...bytes);
}

export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 12 && ascii(bytes.slice(0, 4)) === 'RIFF' && ascii(bytes.slice(8, 12)) === 'WEBP') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (
    bytes.length >= 16
    && ascii(bytes.slice(4, 8)) === 'ftyp'
    && /avif|avis/.test(ascii(bytes.slice(8, Math.min(bytes.length, 32))))
  ) {
    return { mimeType: 'image/avif', extension: 'avif' };
  }
  return null;
}
