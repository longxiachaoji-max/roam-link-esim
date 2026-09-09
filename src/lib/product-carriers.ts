const CARRIER_ALIASES: Record<string, Record<string, string>> = {
  CN: {
    cucc: '中國聯通',
    'china unicom': '中國聯通',
    cmcc: '中國移動',
    'china mobile': '中國移動',
    'china telecom': '中國電信'
  },
  JP: {
    au: 'KDDI',
    kddi: 'KDDI',
    iij: 'Docomo',
    docomo: 'Docomo',
    softbank: 'SoftBank',
    sottbank: 'SoftBank',
    rakuten: 'Rakuten'
  },
  KR: {
    skt: 'SKT',
    'sk telecom': 'SKT',
    kt: 'KT',
    'korea telecom': 'KT',
    lgu: 'LG U+',
    'lgu+': 'LG U+',
    'lg u': 'LG U+',
    'lg u+': 'LG U+'
  },
  TW: {
    cht: '中華電信',
    chunghwa: '中華電信',
    'chunghwa telecom': '中華電信',
    'taiwan mobile': '台灣大哥大',
    fet: '遠傳電信',
    'far eastone': '遠傳電信',
    'taiwan star': '台灣之星',
    'asia pacific': '亞太電信'
  }
};

export function normalizeCarrierName(rawCarrier: string, countryCode = '') {
  const raw = rawCarrier.trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const aliases = CARRIER_ALIASES[countryCode.trim().toUpperCase()] || {};
  return aliases[lower] || raw;
}

function carriersFromEntry(entry: string) {
  const colonIndex = entry.indexOf(':');
  if (colonIndex < 0) return [];
  const countryCode = entry.slice(0, colonIndex).trim().toUpperCase();
  const carrierPart = entry.slice(colonIndex + 1).trim();

  // A comma inside a carrier name is valid. Supplier carriers are separated by `],`.
  return carrierPart
    .split(/\]\s*,\s*/)
    .map(part => normalizeCarrierName(part.replace(/\].*$/, '').split('[')[0] || '', countryCode))
    .filter(Boolean);
}

export function getProductCarrierNames(networks: string | null | undefined, countryCode?: string) {
  const entries = String(networks || '')
    .split('|')
    .map(entry => entry.trim())
    .filter(entry => entry.includes(':'));
  if (!entries.length) return '';

  const targetCode = String(countryCode || '').trim().toUpperCase();
  const matchingEntries = targetCode
    ? entries.filter(entry => entry.slice(0, entry.indexOf(':')).trim().toUpperCase() === targetCode)
    : [];
  const selectedEntries = matchingEntries.length ? matchingEntries : entries;
  const seen = new Set<string>();
  const carriers: string[] = [];

  for (const carrier of selectedEntries.flatMap(carriersFromEntry)) {
    const key = carrier.toLocaleLowerCase('en');
    if (seen.has(key)) continue;
    seen.add(key);
    carriers.push(carrier);
  }

  return carriers.join(' / ');
}
