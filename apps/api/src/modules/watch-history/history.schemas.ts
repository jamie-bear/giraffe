import { z } from 'zod';

export const progressBodySchema = z.object({
  contentId: z.string().uuid(),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
  progressSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().positive(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const historyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const progressLookupParamsSchema = z.object({
  contentId: z.string().uuid(),
});

export const progressLookupQuerySchema = z.object({
  season: z.coerce.number().int().positive().optional(),
  episode: z.coerce.number().int().positive().optional(),
});
