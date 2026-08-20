export interface ProductReviewJsonLdInput {
  rating: number;
  comment: string;
  createdAt: string;
}

export function buildProductReviewJsonLd(reviews: ProductReviewJsonLdInput[]) {
  return reviews
    .filter(review => review.rating >= 1 && review.rating <= 5 && review.comment.trim())
    .slice(0, 12)
    .map(review => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: '已購買會員'
      },
      datePublished: review.createdAt,
      reviewBody: review.comment.trim(),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1
      }
    }));
}
