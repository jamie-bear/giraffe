import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  streamSourcesParamsSchema,
  streamSourcesQuerySchema,
  resolveBodySchema,
  subtitlesParamsSchema,
  subtitlesQuerySchema,
} from './streaming.schemas.js';
import * as streamingService from './streaming.service.js';
import type { ContentType } from '@giraffe/shared';

export async function streamingRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // All streaming routes require auth
  typedApp.addHook('preHandler', app.authenticate);

  typedApp.get(
    '/:type/:tmdbId/sources',
    {
      schema: {
        params: streamSourcesParamsSchema,
        querystring: streamSourcesQuerySchema,
      },
    },
    async (request) => {
      const { type, tmdbId } = request.params;
      const { season, episode } = request.query;
      return streamingService.getStreamSources(
        request.user.sub,
        type as ContentType,
        tmdbId,
        season,
        episode,
      );
    },
  );

  typedApp.post(
    '/resolve',
    {
      schema: { body: resolveBodySchema },
    },
    async (request) => {
      const { sourceId } = request.body;
      return streamingService.resolveStream(request.user.sub, sourceId);
    },
  );

  typedApp.get(
    '/:type/:tmdbId/subtitles',
    {
      schema: {
        params: subtitlesParamsSchema,
        querystring: subtitlesQuerySchema,
      },
    },
    async (request) => {
      const { type, tmdbId } = request.params;
      const { lang, season, episode } = request.query;
      return streamingService.getSubtitles(tmdbId, type as ContentType, lang, season, episode);
    },
  );
}
