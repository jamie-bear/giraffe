import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { metadataRoutes } from './modules/metadata/metadata.routes.js';
import { streamingRoutes } from './modules/streaming/streaming.routes.js';
import { transcodeRoutes } from './modules/transcode/transcode.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { ratingsRoutes } from './modules/ratings/ratings.routes.js';
import { historyRoutes } from './modules/watch-history/history.routes.js';
import { AppError } from './utils/errors.js';

export function buildApp() {
  const isDev = process.env.NODE_ENV !== 'production';

  const app = Fastify({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(error.toJSON());
    }

    // Zod validation errors from fastify-type-provider-zod
    if (error.validation) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
        statusCode: 400,
      });
    }

    app.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  });

  // Plugins
  app.register(corsPlugin);
  app.register(rateLimitPlugin);
  app.register(authPlugin);

  // Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(metadataRoutes, { prefix: '/api/v1' });
  app.register(streamingRoutes, { prefix: '/api/v1/stream' });
  app.register(transcodeRoutes, { prefix: '/api/v1/transcode' });
  app.register(userRoutes, { prefix: '/api/v1/user' });
  app.register(ratingsRoutes, { prefix: '/api/v1/ratings' });
  app.register(historyRoutes, { prefix: '/api/v1/history' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
