export interface RentalPriceTier {
  days: number;
  mode: 'fixed_total' | 'discount';
  total?: number;
  discount?: number;
}

export function normalizeRentalPriceTiers(value: unknown): RentalPriceTier[] {
  if (!Array.isArray(value)) return [];
  const byDays = new Map<number, RentalPriceTier>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const tier = item as Record<string, unknown>;
    const days = Number(tier.days);
    if (!Number.isInteger(days) || days < 2 || days > 365) continue;

    const mode = tier.mode === 'discount' ? 'discount' : 'fixed_total';
    if (mode === 'discount') {
      const discount = Number(tier.discount);
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) continue;
      byDays.set(days, { days, mode, discount });
      continue;
    }

    const total = Number(tier.total);
    if (!Number.isFinite(total) || total < 0) continue;
    byDays.set(days, { days, mode, total: Math.round(total) });
  }
  return [...byDays.values()].sort((a, b) => a.days - b.days);
}

export function calculateRentalPrice(dailyRate: number, days: number, tiers: RentalPriceTier[]) {
  const normalizedDays = Math.max(1, Math.round(days));
  const tier = normalizeRentalPriceTiers(tiers)
    .filter(item => item.days <= normalizedDays)
    .at(-1);
  if (!tier) return Math.round(dailyRate) * normalizedDays;
  if (tier.mode === 'discount') {
    return Math.round(dailyRate * normalizedDays * (100 - (tier.discount || 0)) / 100);
  }
  return Math.round((tier.total || 0) * normalizedDays / tier.days);
}

export function rentalTierLabel(tier: RentalPriceTier) {
  return tier.mode === 'discount'
    ? `${tier.days} 天起 ${100 - (tier.discount || 0)} 折`
    : `${tier.days} 天 NT$${Number(tier.total || 0).toLocaleString()} 起`;
}
