import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  preferences: z
    .object({
      language: z.string().min(2).max(10).optional(),
      subtitleLanguage: z.string().min(2).max(10).optional(),
      preferredQuality: z.enum(['720p', '1080p', '2160p']).optional(),
      autoplay: z.boolean().optional(),
    })
    .optional(),
});

export const debridKeyBodySchema = z.object({
  apiKey: z.string().min(1),
  provider: z.enum(['real-debrid', 'torbox']).default('real-debrid'),
});
