import { MAX_HOME_CAROUSEL_ITEMS, type HomeCarouselItem } from '@/lib/home-carousel-types';

const HOME_CAROUSEL_PATTERN = /\n?<!--HOME_CAROUSEL:([A-Za-z0-9+/=]+)-->\n?/;

function safeImageUrl(value: unknown) {
  const candidate = String(value || '').trim();
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function safeLinkUrl(value: unknown) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate.slice(0, 500);
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeHomeCarousel(value: unknown): HomeCarouselItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_HOME_CAROUSEL_ITEMS)
    .map((item, index) => {
      const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: String(source.id || `banner-${index}`).slice(0, 100),
        image_url: safeImageUrl(source.image_url),
        storage_path: String(source.storage_path || '').trim().slice(0, 500),
        alt_text: String(source.alt_text || '一飛通最新活動').trim().slice(0, 120),
        link_url: safeLinkUrl(source.link_url),
        duration_seconds: Number.isFinite(Number(source.duration_seconds))
          ? Math.min(120, Math.max(3, Math.round(Number(source.duration_seconds))))
          : 10,
        is_active: source.is_active !== false
      };
    })
    .filter(item => item.image_url);
}

export function parseHomeCarousel(value: string | null | undefined) {
  const match = (value || '').match(HOME_CAROUSEL_PATTERN);
  if (!match?.[1]) return [];

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    return normalizeHomeCarousel(JSON.parse(decoded));
  } catch {
    return [];
  }
}

export function withHomeCarousel(value: string | null | undefined, items: unknown) {
  const withoutCarousel = (value || '').replace(HOME_CAROUSEL_PATTERN, '').trim();
  const normalized = normalizeHomeCarousel(items);
  if (normalized.length === 0) return withoutCarousel;

  const encoded = Buffer.from(JSON.stringify(normalized), 'utf8').toString('base64');
  return `${withoutCarousel}${withoutCarousel ? '\n\n' : ''}<!--HOME_CAROUSEL:${encoded}-->`;
}
