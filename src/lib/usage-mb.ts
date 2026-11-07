// 把 MicroEsim 用量字串轉成 MB 數字
const UNIT_TO_MB: Record<string, number> = { B: 1 / 1024 / 1024, KB: 1 / 1024, MB: 1, GB: 1024, TB: 1024 * 1024 };

/** "3404.44 MB" → 3404.44；沒有單位當作 MB */
export function parseUsageMb(value: string | null | undefined): number | null {
  const match = String(value ?? '').trim().match(/^([\d.,]+)\s*([KMGT]?B)?$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const unit = (match[2] || 'MB').toUpperCase();
  return Math.round(amount * (UNIT_TO_MB[unit] ?? 1) * 100) / 100;
}
