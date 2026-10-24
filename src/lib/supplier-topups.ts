// 後台「廠商儲值紀錄」：記錄每次儲值到 MicroEsim 付了多少台幣、實際入帳多少美金，
// 用來算實際匯率。資料和其他後台設定一樣存在 site_settings.usage_guide 的隱藏區塊（只有管理員可讀）。

export interface SupplierTopup {
  id: string;
  date: string; // YYYY-MM-DD（台灣日期）
  twd: number;
  usd: number;
  balanceAfterUsd: number | null; // 儲值後 Micro 後台顯示的餘額（選填）
  note: string;
  microTransactionId: string | null; // 從 Micro 入帳紀錄帶入時，記下對應的交易 ID，避免重複記錄
  createdAt: string;
}

export interface SupplierTopupSummary {
  count: number;
  totalTwd: number;
  totalUsd: number;
  averageRate: number | null; // 每 1 美金花多少台幣
  latestRate: number | null;
  latestBalanceUsd: number | null;
  latestBalanceDate: string | null;
}

const SUPPLIER_TOPUPS_PATTERN = /\n?<!--SUPPLIER_TOPUPS:([\s\S]*?)-->\n?/;
const MAX_RECORDS = 500;

function toMoney(value: unknown, digits: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

export function rateOf(record: Pick<SupplierTopup, 'twd' | 'usd'>) {
  return record.usd > 0 ? record.twd / record.usd : null;
}

export function normalizeSupplierTopupInput(input: {
  date?: unknown;
  twd?: unknown;
  usd?: unknown;
  balanceAfterUsd?: unknown;
  note?: unknown;
  microTransactionId?: unknown;
}) {
  const date = String(input.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('請選擇儲值日期');
  const twd = toMoney(input.twd, 0);
  if (!Number.isFinite(twd) || twd <= 0) throw new Error('台幣金額必須大於 0');
  const usd = toMoney(input.usd, 2);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('入帳美金必須大於 0');
  const balanceText = String(input.balanceAfterUsd ?? '').trim();
  const balanceAfterUsd = balanceText ? toMoney(balanceText, 2) : null;
  if (balanceAfterUsd !== null && (!Number.isFinite(balanceAfterUsd) || balanceAfterUsd < 0)) {
    throw new Error('儲值後餘額必須是 0 以上的數字');
  }
  const microTransactionId = String(input.microTransactionId || '').trim().slice(0, 100) || null;
  return { date, twd, usd, balanceAfterUsd, note: String(input.note || '').trim().slice(0, 200), microTransactionId };
}

function sortRecords(records: SupplierTopup[]) {
  return [...records].sort((a, b) => (b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt));
}

export function parseSupplierTopups(usageGuide: string | null | undefined): SupplierTopup[] {
  const match = (usageGuide || '').match(SUPPLIER_TOPUPS_PATTERN);
  if (!match?.[1]) return [];
  try {
    const raw = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    if (!Array.isArray(raw)) return [];
    return sortRecords(raw.filter(record => (
      record && typeof record.id === 'string' && typeof record.date === 'string'
      && Number(record.twd) > 0 && Number(record.usd) > 0
    )).map(record => ({
      id: record.id,
      date: record.date,
      twd: Number(record.twd),
      usd: Number(record.usd),
      balanceAfterUsd: record.balanceAfterUsd === null || record.balanceAfterUsd === undefined ? null : Number(record.balanceAfterUsd),
      note: String(record.note || ''),
      microTransactionId: typeof record.microTransactionId === 'string' ? record.microTransactionId : null,
      createdAt: String(record.createdAt || '')
    })));
  } catch {
    return [];
  }
}

export function withSupplierTopups(usageGuide: string | null | undefined, records: SupplierTopup[]) {
  const cleanGuide = (usageGuide || '').replace(SUPPLIER_TOPUPS_PATTERN, '\n').trim();
  const encoded = Buffer.from(JSON.stringify(sortRecords(records).slice(0, MAX_RECORDS)), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--SUPPLIER_TOPUPS:${encoded}-->`;
}

export function summarizeSupplierTopups(records: SupplierTopup[]): SupplierTopupSummary {
  const sorted = sortRecords(records);
  const totalTwd = sorted.reduce((sum, record) => sum + record.twd, 0);
  const totalUsd = Math.round(sorted.reduce((sum, record) => sum + record.usd, 0) * 100) / 100;
  const latestWithBalance = sorted.find(record => record.balanceAfterUsd !== null);
  return {
    count: sorted.length,
    totalTwd,
    totalUsd,
    averageRate: totalUsd > 0 ? totalTwd / totalUsd : null,
    latestRate: sorted[0] ? rateOf(sorted[0]) : null,
    latestBalanceUsd: latestWithBalance?.balanceAfterUsd ?? null,
    latestBalanceDate: latestWithBalance?.date ?? null
  };
}
