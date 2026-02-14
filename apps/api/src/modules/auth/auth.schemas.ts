import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(), // Can come from cookie instead
});

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
  }),
  accessToken: z.string(),
});
