import { z } from 'zod';

export const contentTypeSchema = z.enum(['movie', 'tv']);

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.coerce.number().int().positive().default(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const discoverQuerySchema = z.object({
  genre: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  sort: z
    .enum(['popularity.desc', 'popularity.asc', 'vote_average.desc', 'release_date.desc', 'release_date.asc'])
    .default('popularity.desc'),
  page: z.coerce.number().int().positive().default(1),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
