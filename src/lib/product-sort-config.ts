const SORT_CONFIG_PATTERN = /\n?<!--PRODUCT_SORT_CONFIG:([\s\S]*?)-->\n?/;

export function parseProductSortConfig(usageGuide: string | null) {
  const match = (usageGuide || '').match(SORT_CONFIG_PATTERN);
  if (!match?.[1]) return { countries: [], plans: [] };

  try {
    const parsed = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    return {
      countries: Array.isArray(parsed.countries) ? parsed.countries.filter(Boolean) : [],
      plans: Array.isArray(parsed.plans) ? parsed.plans.filter(Boolean) : []
    };
  } catch {
    return { countries: [], plans: [] };
  }
}

export function getProductSortIndex(items: string[], key: string) {
  const index = items.indexOf(key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
