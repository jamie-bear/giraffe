import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createRatingSchema,
  contentRatingParamsSchema,
  userRatingsQuerySchema,
  ratingIdParamsSchema,
} from './ratings.schemas.js';
import * as ratingsService from './ratings.service.js';

export async function ratingsRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('preHandler', app.authenticate);

  typedApp.post(
    '/',
    { schema: { body: createRatingSchema } },
    async (request) => {
      const { contentId, rating, reviewText } = request.body;
      return ratingsService.createOrUpdateRating(request.user.sub, contentId, rating, reviewText);
    },
  );

  typedApp.get(
    '/content/:contentId',
    { schema: { params: contentRatingParamsSchema } },
    async (request) => {
      return ratingsService.getContentRating(request.params.contentId, request.user.sub);
    },
  );

  typedApp.get(
    '/user',
    { schema: { querystring: userRatingsQuerySchema } },
    async (request) => {
      const { page, limit } = request.query;
      return ratingsService.getUserRatings(request.user.sub, page, limit);
    },
  );

  typedApp.delete(
    '/:id',
    { schema: { params: ratingIdParamsSchema } },
    async (request, reply) => {
      await ratingsService.deleteRating(request.user.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
