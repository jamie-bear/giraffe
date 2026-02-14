import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { progressBodySchema, historyQuerySchema, historyIdParamsSchema } from './history.schemas.js';
import * as historyService from './history.service.js';

export async function historyRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('preHandler', app.authenticate);

  typedApp.post(
    '/progress',
    { schema: { body: progressBodySchema } },
    async (request) => {
      return historyService.updateProgress(request.user.sub, request.body);
    },
  );

  typedApp.get(
    '/',
    { schema: { querystring: historyQuerySchema } },
    async (request) => {
      const { page, limit } = request.query;
      return historyService.getHistory(request.user.sub, page, limit);
    },
  );

  typedApp.get('/continue', async (request) => {
    return historyService.getContinueWatching(request.user.sub);
  });

  typedApp.delete(
    '/:id',
    { schema: { params: historyIdParamsSchema } },
    async (request, reply) => {
      await historyService.deleteHistoryEntry(request.user.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
