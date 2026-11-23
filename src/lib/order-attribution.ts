// 訂單來源：客人從哪裡進到網站（搜尋引擎、廣告、LINE、推薦連結…）
// 瀏覽器記下「第一次」和「最近一次」從外部進站的資訊，結帳時一起送到伺服器存在訂單上。
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AttributionTouch {
  source?: string;   // utm_source
  medium?: string;   // utm_medium
  campaign?: string; // utm_campaign
  term?: string;     // utm_term（廣告關鍵字；自然搜尋 Google 不會提供關鍵字）
  content?: string;  // utm_content
  gclid?: boolean;   // Google 廣告點擊
  fbclid?: boolean;  // Facebook／Instagram 連結點擊
  ref?: string;      // 推薦碼 ?ref=
  referrer?: string; // 來源網址（只留網域＋路徑）
  landing?: string;  // 進站頁面
  inApp?: string;    // line / facebook / instagram 內建瀏覽器
  at?: string;
}

export interface OrderAttribution {
  first?: AttributionTouch | null;
  last?: AttributionTouch | null;
}

const MAX_TEXT = 120;
const text = (value: unknown, max = MAX_TEXT) => {
  const s = typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '';
  return s || undefined;
};

function sanitizeTouch(value: unknown): AttributionTouch | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const touch: AttributionTouch = {
    source: text(v.source, 60)?.toLowerCase(),
    medium: text(v.medium, 60)?.toLowerCase(),
    campaign: text(v.campaign),
    term: text(v.term),
    content: text(v.content),
    gclid: v.gclid === true || undefined,
    fbclid: v.fbclid === true || undefined,
    ref: text(v.ref, 40),
    referrer: text(v.referrer, 200),
    landing: text(v.landing, 200),
    inApp: text(v.inApp, 20)?.toLowerCase(),
    at: text(v.at, 40),
  };
  const clean = Object.fromEntries(Object.entries(touch).filter(([, x]) => x !== undefined)) as AttributionTouch;
  return Object.keys(clean).length ? clean : null;
}

export function sanitizeAttribution(value: unknown): OrderAttribution | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const first = sanitizeTouch(v.first);
  const last = sanitizeTouch(v.last);
  if (!first && !last) return null;
  return { first, last };
}

const hostOf = (referrer?: string) => {
  if (!referrer) return '';
  try { return new URL(referrer.includes('://') ? referrer : `https://${referrer}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

const PAID = /^(cpc|ppc|paid|ads?|paidsocial|paid_social|display|cpm)$/;

/** 把一次進站歸類成中文管道名稱 */
export function classifyTouch(touch: AttributionTouch | null | undefined): string {
  if (!touch) return '未知';
  const source = touch.source || '';
  const medium = touch.medium || '';
  const host = hostOf(touch.referrer);
  const referrer = touch.referrer || '';

  if (referrer.startsWith('android-app://space.firstesim.app')) return 'App';
  if (touch.ref || medium === 'referral' && source === 'dealer') return '推薦連結';
  if (touch.gclid || (/google/.test(source) && PAID.test(medium))) return 'Google 廣告';
  if ((/facebook|fb|instagram|ig|meta/.test(source) && PAID.test(medium))) return 'FB/IG 廣告';
  if (source === 'line' || /(^|\.)line\.me$|(^|\.)line-apps\.com$/.test(host) || touch.inApp === 'line') return 'LINE';
  if (/(^|\.)google\./.test(host) || source === 'google') return 'Google 搜尋';
  if (/(^|\.)(bing\.com|yahoo\.com|search\.yahoo|duckduckgo\.com|baidu\.com|naver\.com)/.test(host)) return '其他搜尋引擎';
  if (/instagram/.test(host) || source === 'instagram' || touch.inApp === 'instagram') return 'Instagram';
  if (/facebook|fb\.com|fb\.me/.test(host) || source === 'facebook' || touch.fbclid || touch.inApp === 'facebook') return 'Facebook';
  if (/threads\.(net|com)/.test(host) || source === 'threads') return 'Threads';
  if (/youtube|youtu\.be/.test(host) || source === 'youtube') return 'YouTube';
  if (/dcard\.tw/.test(host) || source === 'dcard') return 'Dcard';
  if (/ptt\.cc/.test(host)) return 'PTT';
  if (/chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google/.test(host)) return 'AI 助理';
  if (source) return source;
  if (host) return `其他網站（${host}）`;
  return '直接造訪';
}

/** 訂單的管道：以最近一次外部進站為準，沒有就用第一次 */
export function classifyAttribution(attribution: OrderAttribution | null | undefined) {
  const last = attribution?.last ? classifyTouch(attribution.last) : null;
  if (last && last !== '直接造訪') return last;
  const first = attribution?.first ? classifyTouch(attribution.first) : null;
  return first || last || '未知';
}

/** 存到訂單上；失敗不影響結帳 */
export async function saveOrderAttribution(supabase: SupabaseClient, orderId: string, raw: unknown) {
  try {
    const attribution = sanitizeAttribution(raw);
    const { error } = await supabase
      .from('orders')
      .update({ attribution, source_channel: attribution ? classifyAttribution(attribution) : '未知' })
      .eq('id', orderId);
    if (error) console.warn('Save order attribution failed:', error.message);
  } catch (error) {
    console.warn('Save order attribution failed:', error);
  }
}
