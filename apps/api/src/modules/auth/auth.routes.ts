import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerBodySchema, loginBodySchema } from './auth.schemas.js';
import {
  registerUser,
  verifyCredentials,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './auth.service.js';
import { config } from '../../config/index.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
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
    const oldToken = request.cookies[REFRESH_COOKIE];
    if (!oldToken) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'No refresh token', statusCode: 401 });
    }

    const { userId, newToken } = await rotateRefreshToken(oldToken);

    // Look up username for the new access token
    const accessToken = app.jwt.sign({ sub: userId, username: '' });

    reply.setCookie(REFRESH_COOKIE, newToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
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
