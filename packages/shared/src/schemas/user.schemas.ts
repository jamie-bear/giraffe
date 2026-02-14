import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  language: z.string().min(2).max(10).optional(),
  subtitleLanguage: z.string().min(2).max(10).optional(),
  preferredQuality: z.enum(['720p', '1080p', '2160p']).optional(),
  autoplay: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const debridKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  provider: z.enum(['real-debrid', 'torbox']).default('real-debrid'),
});

export type DebridKeyInput = z.infer<typeof debridKeySchema>;
