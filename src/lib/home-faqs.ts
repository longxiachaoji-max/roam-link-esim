import {
  DEFAULT_HOME_FAQS,
  MAX_HOME_FAQ_ITEMS,
  type HomeFaqItem
} from '@/lib/home-faq-types';

const HOME_FAQS_PATTERN = /\n?<!--HOME_FAQS:([A-Za-z0-9+/=]+)-->\n?/;

export function normalizeHomeFaqs(value: unknown): HomeFaqItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_HOME_FAQ_ITEMS)
    .map((item, index) => {
      const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: String(source.id || `faq-${index}`).trim().slice(0, 100),
        question: String(source.question || '').trim().slice(0, 160),
        answer: String(source.answer || '').trim().slice(0, 3000),
        is_active: source.is_active !== false
      };
    })
    .filter(item => item.question && item.answer);
}

export function parseHomeFaqs(value: string | null | undefined) {
  const match = (value || '').match(HOME_FAQS_PATTERN);
  if (!match?.[1]) return DEFAULT_HOME_FAQS;

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    return normalizeHomeFaqs(JSON.parse(decoded));
  } catch {
    return DEFAULT_HOME_FAQS;
  }
}

export function withHomeFaqs(value: string | null | undefined, items: unknown) {
  const withoutFaqs = (value || '').replace(HOME_FAQS_PATTERN, '').trim();
  const normalized = normalizeHomeFaqs(items);
  const encoded = Buffer.from(JSON.stringify(normalized), 'utf8').toString('base64');
  return `${withoutFaqs}${withoutFaqs ? '\n\n' : ''}<!--HOME_FAQS:${encoded}-->`;
}
