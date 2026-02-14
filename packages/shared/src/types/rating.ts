export interface Rating {
  id: string;
  userId: string;
  contentId: string;
  rating: number; // 1-10 (half-star intervals: 1 = 0.5 stars, 10 = 5 stars)
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingAggregate {
  contentId: string;
  averageRating: number | null;
  totalRatings: number;
  userRating: Rating | null;
}
