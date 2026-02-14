import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerBodySchema, loginBodySchema } from './auth.schemas.js';
import { eq } from 'drizzle-orm';
import {
  registerUser,
  verifyCredentials,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './auth.service.js';
import { config } from '../../config/index.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';

const REFRESH_COOKIE = 'refreshToken';

// In production with cross-origin (e.g. Vercel frontend → Railway API),
// cookies must use sameSite: 'none' + secure: true to be sent cross-origin.
const isProduction = config.NODE_ENV === 'production';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction, // must be true for sameSite 'none'
  sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export async function authRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/register',
    {
      schema: {
        body: registerBodySchema,
      },
    },
    async (request, reply) => {
      const { email, username, password } = request.body;
      const user = await registerUser(email, username, password);
      const accessToken = app.jwt.sign({ sub: user.id, username: user.username });
      const refreshToken = await createRefreshToken(user.id);

      reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
      return { user, accessToken };
    },
  );

  typedApp.post(
    '/login',
    {
      schema: {
        body: loginBodySchema,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await verifyCredentials(email, password);
      const accessToken = app.jwt.sign({ sub: user.id, username: user.username });
      const refreshToken = await createRefreshToken(user.id);

      reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
      return { user, accessToken };
    },
  );

  typedApp.post('/refresh', async (request, reply) => {
    try {
      const oldToken = request.cookies?.[REFRESH_COOKIE];
      if (!oldToken) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'No refresh token', statusCode: 401 });
      }

      const { userId, newToken } = await rotateRefreshToken(oldToken);

      // Look up username for the new access token
      const [user] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const accessToken = app.jwt.sign({ sub: userId, username: user?.username ?? '' });

      reply.setCookie(REFRESH_COOKIE, newToken, REFRESH_COOKIE_OPTIONS);
      return { accessToken };
    } catch (err) {
      // Log the actual error for debugging, return 401 to client
      app.log.error(err, 'Token refresh failed');
      return reply.code(401).send({ error: 'Unauthorized', message: 'Token refresh failed', statusCode: 401 });
    }
  });

  typedApp.post(
    '/logout',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) {
        await revokeRefreshToken(token);
      }
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      return { message: 'Logged out' };
    },
  );
}
