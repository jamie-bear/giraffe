import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
});

export const contentParamsSchema = z.object({
  type: z.enum(['movie', 'tv']),
  tmdbId: z.coerce.number().int().positive(),
});

export const trendingParamsSchema = z.object({
  type: z.enum(['movie', 'tv']),
});

export const discoverParamsSchema = z.object({
  type: z.enum(['movie', 'tv']),
});

export const seasonParamsSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  seasonNumber: z.coerce.number().int().min(1),
});

export const discoverQuerySchema = z.object({
  genre: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  sort: z
    .enum([
      'popularity.desc',
      'popularity.asc',
      'vote_average.desc',
      'release_date.desc',
      'release_date.asc',
    ])
    .default('popularity.desc'),
  page: z.coerce.number().int().positive().default(1),
});
