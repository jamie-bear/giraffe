import { eq, and, avg, count, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { ratings } from '../../db/schema/ratings.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import type { Rating, RatingAggregate } from '@giraffe/shared';

export async function createOrUpdateRating(
  userId: string,
  contentId: string,
  rating: number,
  reviewText?: string,
): Promise<Rating> {
  // Check if user already rated this content
  const [existing] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.contentId, contentId)))
    .limit(1);

  if (existing) {
    // Update existing rating
    const [updated] = await db
      .update(ratings)
      .set({ rating, reviewText: reviewText ?? existing.reviewText, updatedAt: new Date() })
      .where(eq(ratings.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      contentId: updated.contentId,
      rating: updated.rating,
      reviewText: updated.reviewText,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const [created] = await db
    .insert(ratings)
    .values({ userId, contentId, rating, reviewText })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    contentId: created.contentId,
    rating: created.rating,
    reviewText: created.reviewText,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function getContentRating(
  contentId: string,
  userId: string,
): Promise<RatingAggregate> {
  // Aggregate stats
  const [stats] = await db
    .select({
      avgRating: avg(ratings.rating),
      totalRatings: count(ratings.id),
    })
    .from(ratings)
    .where(eq(ratings.contentId, contentId));

  // User's rating
  const [userRating] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.contentId, contentId), eq(ratings.userId, userId)))
    .limit(1);

  return {
    contentId,
    averageRating: stats?.avgRating ? parseFloat(String(stats.avgRating)) : null,
    totalRatings: Number(stats?.totalRatings ?? 0),
    userRating: userRating
      ? {
          id: userRating.id,
          userId: userRating.userId,
          contentId: userRating.contentId,
          rating: userRating.rating,
          reviewText: userRating.reviewText,
          createdAt: userRating.createdAt.toISOString(),
          updatedAt: userRating.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function getUserRatings(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const results = await db
    .select()
    .from(ratings)
    .where(eq(ratings.userId, userId))
    .orderBy(desc(ratings.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count(ratings.id) })
    .from(ratings)
    .where(eq(ratings.userId, userId));

  return {
    ratings: results.map((r) => ({
      id: r.id,
      userId: r.userId,
      contentId: r.contentId,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    page,
    totalPages: Math.ceil(Number(total) / limit),
    total: Number(total),
  };
}

export async function deleteRating(userId: string, ratingId: string): Promise<void> {
  const [existing] = await db
    .select({ userId: ratings.userId })
    .from(ratings)
    .where(eq(ratings.id, ratingId))
    .limit(1);

  if (!existing) throw new NotFoundError('Rating not found');
  if (existing.userId !== userId) throw new ForbiddenError('Cannot delete another user\'s rating');

  await db.delete(ratings).where(eq(ratings.id, ratingId));
}
