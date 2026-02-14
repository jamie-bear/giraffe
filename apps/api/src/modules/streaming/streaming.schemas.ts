import { z } from 'zod';

export const streamSourcesParamsSchema = z.object({
  type: z.enum(['movie', 'tv']),
  tmdbId: z.coerce.number().int().positive(),
});

export const streamSourcesQuerySchema = z.object({
  season: z.coerce.number().int().positive().optional(),
  episode: z.coerce.number().int().positive().optional(),
});

export const resolveBodySchema = z.object({
  sourceId: z.string().min(1),
  tmdbId: z.coerce.number().int().positive(),
  contentType: z.enum(['movie', 'tv']),
});

export const subtitlesParamsSchema = z.object({
  type: z.enum(['movie', 'tv']),
  tmdbId: z.coerce.number().int().positive(),
});

export const subtitlesQuerySchema = z.object({
  lang: z.string().min(2).max(10).default('en'),
  season: z.coerce.number().int().positive().optional(),
  episode: z.coerce.number().int().positive().optional(),
});
