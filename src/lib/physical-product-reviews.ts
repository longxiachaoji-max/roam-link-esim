import 'server-only';
import { getPhysicalStoreAdmin } from '@/lib/physical-store';

export interface PublicPhysicalProductReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PublicPhysicalProductReviewSummary {
  averageRating: number;
  reviewCount: number;
  reviews: PublicPhysicalProductReview[];
}

export async function getPublicPhysicalProductReviews(productId: string): Promise<PublicPhysicalProductReviewSummary> {
  const empty = { averageRating: 0, reviewCount: 0, reviews: [] };
  if (!productId) return empty;

  try {
    const { data, error } = await getPhysicalStoreAdmin()
      .from('physical_product_reviews')
      .select('id, rating, comment, created_at')
      .eq('physical_product_id', productId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error || !data) {
      console.error('Public physical product reviews failed:', error?.message || 'No data');
      return empty;
    }

    const allReviews = data.map(review => ({
      id: String(review.id),
      rating: Number(review.rating),
      comment: String(review.comment || '').trim(),
      createdAt: String(review.created_at)
    })).filter(review => review.rating >= 1 && review.rating <= 5 && review.comment.length > 0);
    if (!allReviews.length) return empty;

    return {
      averageRating: allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length,
      reviewCount: allReviews.length,
      reviews: allReviews.slice(0, 12)
    };
  } catch (error) {
    console.error('Public physical product reviews failed:', error instanceof Error ? error.message : error);
    return empty;
  }
}
