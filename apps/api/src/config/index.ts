import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  TMDB_API_KEY: z.string().min(1),
  TMDB_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  OPENSUBTITLES_API_KEY: z.string().optional(),
  // Railway injects PORT; fall back to APP_PORT for local dev
  PORT: z.coerce.number().optional(),
  APP_PORT: z.coerce.number().default(3001),
  APP_HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Comma-separated list of allowed origins. Supports "*" wildcards, e.g.:
  // "http://localhost:3000,https://*.vercel.app"
  CORS_ORIGIN: z.string().default('http://localhost:3000,https://*.vercel.app'),
});

const parsed = envSchema.parse(process.env);

export type AppConfig = z.infer<typeof envSchema>;

export const config = {
  ...parsed,
  // Railway sets PORT, local dev uses APP_PORT
  APP_PORT: parsed.PORT ?? parsed.APP_PORT,
};
