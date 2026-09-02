export type DealerSalesMode = 'direct' | 'referral';

export function normalizeDealerSalesMode(value: unknown): DealerSalesMode {
  return value === 'referral' ? 'referral' : 'direct';
}
