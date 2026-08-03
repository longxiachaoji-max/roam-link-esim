const HIDDEN_SITE_CONFIG_PATTERN = /\n?(<!--[A-Z][A-Z0-9_]*:[\s\S]*?-->)\n?/g;

export function stripHiddenSiteConfig(value: string | null | undefined) {
  return (value || '').replace(HIDDEN_SITE_CONFIG_PATTERN, '').trim();
}

export function getHiddenSiteConfigComments(value: string | null | undefined) {
  return Array.from((value || '').matchAll(HIDDEN_SITE_CONFIG_PATTERN))
    .map(match => match[1])
    .filter(Boolean);
}
