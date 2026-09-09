const NETWORK_ORDER = ['2G', '3G', '4G', '5G'] as const;

export function getProductNetworkType(value?: string | null) {
  const text = String(value || '').toUpperCase();
  const generations = new Set<string>();

  if (/\b2G\b/.test(text)) generations.add('2G');
  if (/\b3G\b|\bUMTS\b|\bHSPA\+?\b/.test(text)) generations.add('3G');
  if (/\b4G\b|\bLTE\b/.test(text)) generations.add('4G');
  if (/\b5G\b|\bNR\b/.test(text)) generations.add('5G');

  return NETWORK_ORDER.filter(generation => generations.has(generation)).join(' / ');
}

export function normalizeProductNetworkType(value?: string | null) {
  const normalized = getProductNetworkType(value);
  return normalized || String(value || '').trim();
}
