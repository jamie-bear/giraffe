import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { updateProfileSchema, debridKeyBodySchema } from './user.schemas.js';
import * as userService from './user.service.js';

export async function userRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('preHandler', app.authenticate);

  typedApp.get('/profile', async (request) => {
    return userService.getProfile(request.user.sub);
  });

  typedApp.patch(
    '/profile',
    { schema: { body: updateProfileSchema } },
    async (request) => {
      return userService.updateProfile(request.user.sub, request.body);
    },
  );

  typedApp.put(
    '/debrid-key',
    { schema: { body: debridKeyBodySchema } },
    async (request, reply) => {
      const { apiKey, provider } = request.body;
      await userService.setDebridKey(request.user.sub, apiKey, provider);
      return reply.code(204).send();
    },
  );

  typedApp.delete('/debrid-key', async (request, reply) => {
    await userService.removeDebridKey(request.user.sub);
    return reply.code(204).send();
  });
}
