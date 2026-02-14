import { z } from 'zod';

export const transcodeBodySchema = z.object({
  sourceId: z.string().min(1),
  tmdbId: z.coerce.number().int().positive(),
  contentType: z.enum(['movie', 'tv']),
});

export const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const segmentParamsSchema = z.object({
  sessionId: z.string().uuid(),
  segment: z.string().regex(/^\d{4}\.ts$/, 'Invalid segment name'),
});
