import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config/index.js';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function originToMatcher(originPattern: string): RegExp | null {
  if (!originPattern.includes('*')) return null;

  const escaped = originPattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}$`);
}

async function corsPlugin(fastify: FastifyInstance) {
  const configuredOrigins = config.CORS_ORIGIN.split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  const exactOrigins = new Set(configuredOrigins.filter((origin) => !origin.includes('*')));
  const wildcardMatchers = configuredOrigins
    .map((pattern) => originToMatcher(pattern))
    .filter((matcher): matcher is RegExp => matcher != null);

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Non-browser clients / server-to-server requests
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (
        exactOrigins.has(normalized) ||
        wildcardMatchers.some((matcher) => matcher.test(normalized))
      ) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export default fp(corsPlugin, { name: 'cors' });
