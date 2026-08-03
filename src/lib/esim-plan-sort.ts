export type EsimPlanSortType = 'unlimited' | 'speed-limited-unlimited' | 'daily' | 'metered' | 'other';

export interface EsimPlanSortKey {
  type: EsimPlanSortType;
  typeOrder: number;
  usageGb: number;
  speedMbps: number;
  normalizedLabel: string;
}

const TYPE_ORDER: Record<EsimPlanSortType, number> = {
  unlimited: 0,
  'speed-limited-unlimited': 1,
  daily: 2,
  metered: 3,
  other: 4
};

function normalizeLabel(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function dataUnitToGb(amount: number, unit: string) {
  switch (unit.toLowerCase()) {
    case 'tb': return amount * 1024;
    case 'gb':
    case 'g': return amount;
    case 'mb':
    case 'm': return amount / 1024;
    case 'kb': return amount / (1024 * 1024);
    default: return 0;
  }
}

function findUsageGb(label: string, type: EsimPlanSortType) {
  const prefixes = type === 'daily'
    ? '(?:每日|每天|daily|per[ -]?day|/day)'
    : '(?:總量|总量|total|fixed|package)';
  const contextual = new RegExp(`${prefixes}[^0-9]{0,12}(\\d+(?:\\.\\d+)?)\\s*(tb|gb|mb|kb|g|m)(?![a-z])`, 'i');
  const match = label.match(contextual)
    || label.match(/(\d+(?:\.\d+)?)\s*(tb|gb|mb|kb|g|m)(?![a-z])/i);
  return match ? dataUnitToGb(Number(match[1]), match[2]) : 0;
}

function findSpeedMbps(label: string) {
  const match = label.match(/(\d+(?:\.\d+)?)\s*(gbps|mbps|kbps)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (match[2].toLowerCase() === 'gbps') return amount * 1000;
  if (match[2].toLowerCase() === 'kbps') return amount / 1000;
  return amount;
}

export function getEsimPlanSortKey(value: string): EsimPlanSortKey {
  const label = normalizeLabel(value || '');
  const isUnlimited = /吃到飽|不限量|无限|無限|unlimited|吃放題/.test(label);
  const isDaily = /每日|每天|daily|per[ -]?day|\/day/.test(label);
  const isMetered = /總量|总量|total|fixed|package/.test(label);
  const speedLimitLabel = label.replace(/不限速/g, '');
  const hasSpeedLimit = /限速|最高速率|最高速度|speed[ -]?limit|limited[ -]?speed|throttl/.test(speedLimitLabel)
    || (isUnlimited && /\d+(?:\.\d+)?\s*(?:gbps|mbps|kbps)/i.test(label));

  let type: EsimPlanSortType = 'other';
  if (isUnlimited) type = hasSpeedLimit ? 'speed-limited-unlimited' : 'unlimited';
  else if (isDaily) type = 'daily';
  else if (isMetered) type = 'metered';

  return {
    type,
    typeOrder: TYPE_ORDER[type],
    usageGb: type === 'daily' || type === 'metered' ? findUsageGb(label, type) : 0,
    speedMbps: type === 'speed-limited-unlimited' ? findSpeedMbps(label) : 0,
    normalizedLabel: label
  };
}

export function compareEsimPlanPriority(left: string, right: string) {
  const a = getEsimPlanSortKey(left);
  const b = getEsimPlanSortKey(right);
  if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
  if (a.usageGb !== b.usageGb) return b.usageGb - a.usageGb;
  if (a.speedMbps !== b.speedMbps) return b.speedMbps - a.speedMbps;
  return 0;
}

export function compareEsimPlanOrder(left: string, right: string) {
  return compareEsimPlanPriority(left, right)
    || normalizeLabel(left).localeCompare(normalizeLabel(right), 'zh-Hant', { numeric: true });
}
