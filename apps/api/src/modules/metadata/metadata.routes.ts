import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  searchQuerySchema,
  contentParamsSchema,
  trendingParamsSchema,
  discoverParamsSchema,
  discoverQuerySchema,
  seasonParamsSchema,
} from './metadata.schemas.js';
import * as metadataService from './metadata.service.js';
import type { ContentType } from '@giraffe/shared';

export async function metadataRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/search',
    {
      preHandler: [app.authenticate],
      schema: { querystring: searchQuerySchema },
    },
    async (request) => {
      const { q, page } = request.query;
      return metadataService.search(q, page);
    },
  );

  typedApp.get(
    '/content/:type/:tmdbId',
    {
      preHandler: [app.authenticate],
      schema: { params: contentParamsSchema },
    },
    async (request) => {
      const { type, tmdbId } = request.params;
      return metadataService.getContentDetail(type as ContentType, tmdbId);
    },
  );

  typedApp.get(
    '/trending/:type',
    {
      preHandler: [app.authenticate],
      schema: { params: trendingParamsSchema },
    },
    async (request) => {
      const { type } = request.params;
      return metadataService.getTrending(type as ContentType);
    },
  );

  typedApp.get(
    '/discover/:type',
    {
      preHandler: [app.authenticate],
      schema: {
        params: discoverParamsSchema,
        querystring: discoverQuerySchema,
      },
    },
    async (request) => {
      const { type } = request.params;
      const { genre, year, sort, page } = request.query;
      return metadataService.discoverContent(type as ContentType, { genre, year, sort, page });
    },
  );

  typedApp.get(
    '/tv/:tmdbId/season/:seasonNumber',
    {
      preHandler: [app.authenticate],
      schema: { params: seasonParamsSchema },
    },
    async (request) => {
      const { tmdbId, seasonNumber } = request.params;
      return metadataService.getSeasonEpisodes(tmdbId, seasonNumber);
    },
  );
}
