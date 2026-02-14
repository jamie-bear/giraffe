import { z } from 'zod';

export const createRatingSchema = z.object({
  contentId: z.string().uuid(),
  rating: z.number().int().min(1).max(10),
  reviewText: z.string().max(5000).optional(),
});

export const contentRatingParamsSchema = z.object({
  contentId: z.string().uuid(),
});

export const userRatingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const ratingIdParamsSchema = z.object({
  id: z.string().uuid(),
});
