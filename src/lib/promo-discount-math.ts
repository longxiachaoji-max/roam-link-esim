export type PromoDiscountType = 'percent' | 'fixed';

export function discountRateToPercent(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 10) throw new Error('折數需介於 0 至 10 折之間');
  return Math.round((10 - rate) * 1000) / 100;
}

export function discountPercentToRate(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) throw new Error('折扣百分比需介於 0% 至 100% 之間');
  return Math.round((10 - percent / 10) * 100) / 100;
}

export function calculatePromoDiscount(
  originalTotal: number,
  discountType: PromoDiscountType,
  discountValue: number,
  maxDiscount = 0
) {
  if (!Number.isFinite(originalTotal) || originalTotal <= 1) throw new Error('訂單金額不正確');
  if (!Number.isFinite(discountValue) || discountValue <= 0) throw new Error('折扣設定不正確');
  let discountAmount = discountType === 'percent'
    ? Math.round(originalTotal * discountValue / 100)
    : Math.round(discountValue);
  if (discountType === 'percent' && maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, Math.round(maxDiscount));
  }
  return Math.min(discountAmount, originalTotal - 1);
}
