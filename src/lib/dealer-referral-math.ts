export type DealerCommissionMode = 'percentage' | 'fixed';

export function calculateDealerCommissionAmount(
  paidTotal: number,
  mode: DealerCommissionMode,
  value: number,
  itemCount: number
) {
  const normalizedValue = Math.max(0, Number(value) || 0);
  if (mode === 'fixed') {
    return Math.max(0, Math.round(normalizedValue * Math.max(1, Math.round(itemCount))));
  }
  return Math.max(0, Math.round(Math.max(0, paidTotal) * normalizedValue / 100));
}
