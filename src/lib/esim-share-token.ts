import { createHmac, timingSafeEqual } from 'node:crypto';

// eSIM 安裝分享連結：把 order_item id 和到期時間簽章後放進網址，
// 不需要資料表；沒有伺服器密鑰就無法偽造或猜到別人的連結。

const SHARE_LINK_DAYS = 30;

function signingKey(secret: string) {
  if (!secret) throw new Error('缺少分享連結簽章密鑰');
  // 從伺服器密鑰衍生專用 key，避免直接拿原始密鑰做簽章
  return createHmac('sha256', secret).update('esim-share-link-v1').digest();
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', signingKey(secret)).update(payload).digest('base64url');
}

export function createEsimShareToken(orderItemId: string, secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SHARE_LINK_DAYS * 24 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ i: orderItemId, e: expiresAt })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyEsimShareToken(token: string, secret: string, now = Date.now()) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data?.i !== 'string' || typeof data?.e !== 'number') return null;
    if (data.e * 1000 < now) return null;
    return { orderItemId: data.i, expiresAt: new Date(data.e * 1000) };
  } catch {
    return null;
  }
}

export function getEsimShareSecret() {
  return process.env.ESIM_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
