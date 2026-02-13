import { z } from 'zod';

export const ResolveStreamRequestDto = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'tv']),
});

export const ResolveStreamResponseDto = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
  selectedQuality: z.enum(['720p', '1080p', '2160p']),
});
