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
    && value.paymentStatus === 'PAID'
    && value.orderStatus === 'COMPLETED'
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
