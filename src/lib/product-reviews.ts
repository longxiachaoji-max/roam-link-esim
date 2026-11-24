export interface ProductReviewInput {
  rating: number;
  smoothnessRating: number;
  comment: string;
}

export interface ProductReviewEligibility {
  customerId: string;
  orderCustomerId: string;
  paymentStatus: string;
  orderStatus: string;
  productId: string | null;
  paymentMethod?: string;
}

export interface PhysicalProductReviewInput {
  rating: number;
  comment: string;
}

function rating(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export function parseProductReviewInput(value: unknown): ProductReviewInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const overallRating = rating(input.rating);
  const smoothnessRating = rating(input.smoothnessRating);
  const comment = String(input.comment || '').trim();
  if (overallRating === null || smoothnessRating === null || comment.length < 2 || comment.length > 1000) return null;
  return { rating: overallRating, smoothnessRating, comment };
}

export function isVerifiedReviewPurchase(value: ProductReviewEligibility) {
  return Boolean(
    value.productId
    && value.customerId === value.orderCustomerId
    && value.orderStatus === 'COMPLETED'
    // 面交現場付款：訂單完成代表已當面交付並收款，即使後台漏按「確認現場已收款」
    && (value.paymentStatus === 'PAID' || value.paymentMethod === 'CASH_PICKUP')
  );
}

export function parsePhysicalProductReviewInput(value: unknown): PhysicalProductReviewInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const overallRating = rating(input.rating);
  const comment = String(input.comment || '').trim();
  if (overallRating === null || comment.length < 2 || comment.length > 1000) return null;
  return { rating: overallRating, comment };
}
