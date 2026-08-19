export type PromoDiscountType = 'percent' | 'fixed';

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
