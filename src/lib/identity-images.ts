import sharp from 'sharp';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] || character);
}

export async function prepareIdentityImage(file: File, watermark: boolean) {
  if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error('每張照片需小於 8MB');
  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('照片格式無法辨識');

  const resized = image.resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true });
  if (!watermark) return resized.jpeg({ quality: 84, mozjpeg: true }).toBuffer();

  const width = Math.min(metadata.width, 1800);
  const height = Math.min(metadata.height, 1800);
  const text = escapeXml(`僅供一飛通租借實名認證使用 ${new Date().toISOString().slice(0, 10)}`);
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${width / 2} ${height / 2}) rotate(-24)" text-anchor="middle">
      <rect x="-${width * 0.47}" y="-58" width="${width * 0.94}" height="116" rx="12" fill="rgba(0,0,0,.38)"/>
      <text x="0" y="14" fill="rgba(255,255,255,.88)" font-family="sans-serif" font-size="${Math.max(28, Math.min(54, width / 18))}" font-weight="700">${text}</text>
    </g>
  </svg>`);
  return resized.composite([{ input: overlay, gravity: 'center' }]).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}
