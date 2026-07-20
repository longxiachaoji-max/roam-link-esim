export interface RentalPriceTier {
  days: number;
  total: number;
}

export function normalizeRentalPriceTiers(value: unknown): RentalPriceTier[] {
  if (!Array.isArray(value)) return [];
  const byDays = new Map<number, number>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const tier = item as Record<string, unknown>;
    const days = Number(tier.days);
    const total = Number(tier.total);
    if (!Number.isInteger(days) || days < 2 || days > 365 || !Number.isFinite(total) || total < 0) continue;
    byDays.set(days, Math.round(total));
  }
  return [...byDays.entries()].sort(([a], [b]) => a - b).map(([days, total]) => ({ days, total }));
}

export function calculateRentalPrice(dailyRate: number, days: number, tiers: RentalPriceTier[]) {
  const tier = tiers.find(item => item.days === days);
  return tier ? tier.total : Math.round(dailyRate) * days;
}
